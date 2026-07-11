
// services/googleDrive.ts
import { getFullDataJson, importData } from './storage';

const SCOPES = 'https://www.googleapis.com/auth/drive.file';
const BACKUP_FILENAME = 'fintrack_backup.json';

// Declare global Google variables
declare global {
  interface Window {
    google: any;
    gapi: any;
  }
}

let tokenClient: any;
let accessToken: string | null = null;
let gapiInited = false;
let gisInited = false;

// Initialize the API client library
export const initGapi = () => {
    return new Promise<void>((resolve, reject) => {
        if (window.gapi) {
            window.gapi.load('client', async () => {
                try {
                    await window.gapi.client.init({
                        discoveryDocs: ['https://www.googleapis.com/discovery/v1/apis/drive/v3/rest'],
                    });
                    gapiInited = true;
                    resolve();
                } catch (e) {
                    reject(e);
                }
            });
        } else {
            reject("Google API script not loaded");
        }
    });
};

// Initialize the Google Identity Services client
export const initGis = (clientId: string) => {
    return new Promise<void>((resolve, reject) => {
        if (window.google) {
            tokenClient = window.google.accounts.oauth2.initTokenClient({
                client_id: clientId,
                scope: SCOPES,
                callback: (tokenResponse: any) => {
                    if (tokenResponse && tokenResponse.access_token) {
                        accessToken = tokenResponse.access_token;
                    }
                },
            });
            gisInited = true;
            resolve();
        } else {
            reject("Google Identity script not loaded");
        }
    });
};

// Check if we already have an active token (helps with remounting components)
export const checkConnection = (): boolean => {
    if (accessToken) return true;
    const token = window.gapi?.client?.getToken();
    if (token && token.access_token) {
        accessToken = token.access_token;
        return true;
    }
    return false;
};

// Trigger Login Flow
export const handleAuthClick = () => {
    return new Promise<string>((resolve, reject) => {
        if (!tokenClient) {
            reject("Token Client not initialized");
            return;
        }

        tokenClient.callback = (resp: any) => {
            if (resp.error) {
                reject(resp);
            }
            accessToken = resp.access_token;
            resolve(resp.access_token);
        };

        if (accessToken === null) {
            tokenClient.requestAccessToken({ prompt: 'consent' });
        } else {
            tokenClient.requestAccessToken({ prompt: '' });
        }
    });
};

// --- Drive Operations ---

const findBackupFile = async () => {
    try {
        const response = await window.gapi.client.drive.files.list({
            'pageSize': 1,
            'fields': "files(id, name, modifiedTime)",
            'q': `name = '${BACKUP_FILENAME}' and trashed = false`
        });
        const files = response.result.files;
        if (files && files.length > 0) {
            return files[0];
        }
        return null;
    } catch (err) {
        console.error("Error finding file", err);
        throw err;
    }
};

export const getBackupMetadata = async (): Promise<{id: string, modifiedTime: string} | null> => {
    if (!accessToken) return null;
    try {
        const file = await findBackupFile();
        if (file) {
            return { id: file.id, modifiedTime: file.modifiedTime };
        }
    } catch (e) {
        return null;
    }
    return null;
};

export const uploadToDrive = async (): Promise<void> => {
    if (!accessToken) throw new Error("Not authenticated");

    const fileContent = getFullDataJson();
    const file = await findBackupFile();
    const fileId = file?.id;
    
    const fileMetadata = {
        'name': BACKUP_FILENAME,
        'mimeType': 'application/json'
    };

    const multipartRequestBody =
        `--foo_bar_baz\r\n` +
        `Content-Type: application/json; charset=UTF-8\r\n\r\n` +
        `${JSON.stringify(fileMetadata)}\r\n` +
        `--foo_bar_baz\r\n` +
        `Content-Type: application/json\r\n\r\n` +
        `${fileContent}\r\n` +
        `--foo_bar_baz--`;

    try {
        if (fileId) {
            await fetch(`https://www.googleapis.com/upload/drive/v3/files/${fileId}?uploadType=multipart`, {
                method: 'PATCH',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz'
                },
                body: multipartRequestBody
            });
        } else {
            await fetch('https://www.googleapis.com/upload/drive/v3/files?uploadType=multipart', {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${accessToken}`,
                    'Content-Type': 'multipart/related; boundary=foo_bar_baz'
                },
                body: multipartRequestBody
            });
        }
    } catch (e) {
        console.error("Upload failed", e);
        throw e;
    }
};

export const downloadFromDrive = async (): Promise<boolean> => {
    if (!accessToken) throw new Error("Not authenticated");

    const file = await findBackupFile();
    const fileId = file?.id;
    
    if (!fileId) {
        throw new Error("找不到雲端備份檔");
    }

    try {
        const response = await window.gapi.client.drive.files.get({
            fileId: fileId,
            alt: 'media'
        });
        
        const jsonString = typeof response.body === 'string' ? response.body : JSON.stringify(response.result);
        return importData(jsonString);
    } catch (e) {
        console.error("Download failed", e);
        throw e;
    }
};
