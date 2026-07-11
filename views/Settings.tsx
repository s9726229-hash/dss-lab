
import React, { useState, useEffect } from 'react';
import { Card, Button, Input, Modal } from '../components/ui';
import { exportData, importData, clearAllData, getGoogleClientId, saveGoogleClientId, getApiKey, saveApiKey, getFeeDiscount, saveFeeDiscount, getTechParameters, saveTechParameters, DEFAULT_TECH_PARAMS, getDSSProfiles, saveDSSProfiles, DSSProfile } from '../services/storage';
import { initGapi, initGis, handleAuthClick, uploadToDrive, downloadFromDrive, getBackupMetadata, checkConnection } from '../services/googleDrive';
import { Download, Upload, CheckCircle2, AlertCircle, X, Cloud, RefreshCw, LogIn, History, Trash2, Key, Eye, EyeOff, Sparkles, ExternalLink, PieChart, ScrollText, CalendarClock, Percent, TrendingUp, Settings as SettingsIcon, FlaskConical } from 'lucide-react';
import { ApiKeyStatus, Asset, AssetType } from '../types';
import { STORAGE_KEYS } from '../constants';
import { fetchFinMindUsage } from '../services/stock';

interface SettingsProps {
  onDataChange: () => void;
}




const DSSProfilesCard: React.FC<{ onApply: (p: DSSProfile) => void }> = ({ onApply }) => {
    const [profiles, setProfiles] = useState<DSSProfile[]>([]);
    const [applied, setApplied] = useState<string | null>(null);

    useEffect(() => { setProfiles(getDSSProfiles()); }, []);

    const handleDelete = (id: string) => {
        const next = profiles.filter(p => p.id !== id);
        saveDSSProfiles(next);
        setProfiles(next);
    };

    const handleApply = (p: DSSProfile) => {
        onApply(p);
        setApplied(p.id);
        setTimeout(() => setApplied(null), 2500);
    };

    if (!profiles.length) return null;

    return (
        <Card className="border-violet-500/30 bg-gradient-to-br from-slate-800 to-slate-900/50">
            <div className="flex items-center gap-2 mb-4">
                <FlaskConical size={18} className="text-violet-400" />
                <h3 className="text-lg font-bold text-white">DSS 設定檔</h3>
                <span className="text-xs text-slate-500 ml-1">由 DSS 實驗室分析產生</span>
            </div>
            <div className="space-y-2">
                {profiles.map(p => (
                    <div key={p.id} className="flex items-center gap-3 p-3 bg-slate-900/50 rounded-xl border border-slate-700/40">
                        <div className="flex-1 min-w-0">
                            <div className="text-sm font-medium text-slate-200">{p.name}</div>
                            <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                                <span className="text-xs text-slate-500">{new Date(p.createdAt).toLocaleString('zh-TW', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' })}</span>
                                <span className="text-xs text-slate-500">比對 {p.source.matched}/{p.source.total} 筆</span>
                                {(['ETF', '上市', '上櫃'] as const).map(cat => {
                                    const c = p.categories[cat];
                                    if (!c) return null;
                                    const color = cat === 'ETF' ? 'text-cyan-400/70' : cat === '上市' ? 'text-emerald-400/70' : 'text-amber-400/70';
                                    return (
                                        <span key={cat} className={`text-xs ${color}`}>
                                            {cat}: 進場 RSI&lt;{c.rsi.toFixed(1)} B20&lt;{c.bias20.toFixed(1)}%
                                            {c.slopeUpDays !== undefined && ` 斜率≥${c.slopeUpDays}天`}
                                            {c.strongBias20 !== undefined && ` ｜強買 B20&lt;${c.strongBias20.toFixed(1)}%`}
                                            {c.exitBias20 !== undefined && ` ｜停利 B20≥${c.exitBias20.toFixed(1)}%`}
                                            {c.exitForceBias20 !== undefined && ` ｜強制停利 B20≥${c.exitForceBias20.toFixed(1)}%`}
                                            {c.stopLossBias20 !== undefined && ` ｜停損 B20≥${c.stopLossBias20.toFixed(1)}%`}
                                        </span>
                                    );
                                })}
                            </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                            {applied === p.id
                                ? <span className="text-xs text-emerald-400 flex items-center gap-1"><CheckCircle2 size={12} />已套用</span>
                                : <button onClick={() => handleApply(p)} className="text-xs px-3 py-1.5 bg-violet-600/20 hover:bg-violet-600/40 border border-violet-500/30 text-violet-300 rounded-lg transition-colors">套用</button>
                            }
                            <button onClick={() => handleDelete(p.id)} className="text-slate-600 hover:text-red-400 transition-colors p-1"><Trash2 size={14} /></button>
                        </div>
                    </div>
                ))}
            </div>
        </Card>
    );
};

export const Settings: React.FC<SettingsProps> = ({ onDataChange }) => {
  const [notification, setNotification] = useState<{type: 'success' | 'error', message: string} | null>(null);
  const [feeDiscount, setFeeDiscount] = useState(0.28);
  const [techParams, setTechParams] = useState(DEFAULT_TECH_PARAMS);

  const [finmindToken, setFinmindToken] = useState('');
  const [apiUsage, setApiUsage] = useState<{ user_count: number, api_request_limit: number } | null>(null);
  const [googleClientId, setGoogleClientId] = useState('');
  const [isDriveConnected, setIsDriveConnected] = useState(false);
  const [isDriveLoading, setIsDriveLoading] = useState(false);

  const [isPreviewModalOpen, setIsPreviewModalOpen] = useState(false);
  const [previewContent, setPreviewContent] = useState<{ raw: string; stats: Record<string, number>; metadata: any } | null>(null);

  useEffect(() => {
    setFeeDiscount(getFeeDiscount());
    setTechParams(getTechParameters());
    setFinmindToken(localStorage.getItem('ft_finmind_token') || '');
    fetchFinMindUsage().then(setApiUsage);
    const storedClientId = getGoogleClientId();
    if (storedClientId) {
        setGoogleClientId(storedClientId);
        autoInitDrive(storedClientId);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const autoInitDrive = async (clientId: string) => {
      try {
          await initGapi();
          await initGis(clientId);
          if (checkConnection()) setIsDriveConnected(true);
      } catch (e) {
          console.debug("Drive auto-init skipped", e);
      }
  };

  const showNotify = (type: 'success' | 'error', message: string) => {
      setNotification({ type, message });
      setTimeout(() => setNotification(null), 5000);
  };


  
  const handleSaveFeeDiscount = () => {
      saveFeeDiscount(feeDiscount);
      showNotify('success', '手續費折扣已儲存！');
  };

  const triggerRescan = () => {
      localStorage.setItem('needs_rescan_inventory', 'true');
      localStorage.setItem('needs_rescan_watchlist', 'true');
      // 同 window 的 localStorage.setItem 不觸發 storage 事件，需手動 dispatch
      window.dispatchEvent(new StorageEvent('storage', { key: 'needs_rescan_inventory', newValue: 'true' }));
      window.dispatchEvent(new StorageEvent('storage', { key: 'needs_rescan_watchlist', newValue: 'true' }));
  };

  const handleSaveTechParams = () => {
      saveTechParameters(techParams);
      triggerRescan();
      showNotify('success', '技術面參數已儲存！正在重新分析...');
  };

  const handleResetTechParams = () => {
      if(confirm('確定要還原為系統預設的技術面參數嗎？')) {
          setTechParams(DEFAULT_TECH_PARAMS);
          saveTechParameters(DEFAULT_TECH_PARAMS);
          triggerRescan();
          showNotify('success', '已還原預設參數！正在重新分析...');
      }
  };

  const handleSaveFinMindToken = () => {
      localStorage.setItem('ft_finmind_token', finmindToken.trim());
      showNotify('success', 'FinMind API Token Saved!');
        fetchFinMindUsage().then(setApiUsage);
  };

  const handleSaveClientId = () => {
      saveGoogleClientId(googleClientId.trim());
      showNotify('success', 'Google Client ID 已儲存。請嘗試點擊連接。');
      autoInitDrive(googleClientId.trim());
  };

  const handleConnectDrive = async () => {
      if (!googleClientId) {
          showNotify('error', '請先輸入 Google Client ID');
          return;
      }
      setIsDriveLoading(true);
      try {
          await initGapi();
          await initGis(googleClientId);
          await handleAuthClick();
          setIsDriveConnected(true);
          showNotify('success', 'Google Drive 連接成功！');
          const backup = await getBackupMetadata();
          if (backup) {
              const date = new Date(backup.modifiedTime).toLocaleString();
              if (confirm(`🔍 偵測到雲端備份檔\n\n備份時間：${date}\n\n是否立即下載並還原至此裝置？`)) {
                  await performRestore();
              }
          }
      } catch (e: any) {
          showNotify('error', `連接失敗: ${e.message || '授權錯誤，請檢查來源網址設定'}`);
      } finally {
          setIsDriveLoading(false);
      }
  };

  const handleBackupToDrive = async () => {
      if(!isDriveConnected) return;
      setIsDriveLoading(true);
      try {
          await uploadToDrive();
          showNotify('success', '備份成功！資料已加密存儲至您的 Google Drive。');
      } catch (e) {
          showNotify('error', '上傳失敗，請檢查網路或授權。');
      } finally {
          setIsDriveLoading(false);
      }
  };

  const performRestore = async () => {
      try {
          const success = await downloadFromDrive();
          if (success) {
              onDataChange();
              showNotify('success', '還原成功！所有資料已同步至此裝置。');
          } else {
              showNotify('error', '還原失敗：檔案格式不正確。');
          }
      } catch (e: any) {
           showNotify('error', `下載失敗: ${e.message || '找不到備份檔'}`);
      }
  };

  const handleRestoreFromDrive = async () => {
      if(!isDriveConnected) return;
      if(!confirm("確定要從雲端還原嗎？這將覆蓋現有資料。")) return;
      setIsDriveLoading(true);
      await performRestore();
      setIsDriveLoading(false);
  };

  const handleImportFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      const reader = new FileReader();
      reader.onload = (ev) => {
        if (ev.target?.result) {
          const jsonString = ev.target.result as string;
          try {
            const data = JSON.parse(jsonString);
            const assets: Asset[] = data[STORAGE_KEYS.ASSETS] || [];
            const stockCount = assets.filter(a => a.type === AssetType.STOCK).length;

            const stats = {
                assets: assets.length || 0,
                transactions: data[STORAGE_KEYS.TRANSACTIONS]?.length || 0,
                recurring: data[STORAGE_KEYS.RECURRING]?.length || 0,
                stocks: stockCount,
            };
            setPreviewContent({ raw: jsonString, stats, metadata: data.ft_metadata });
            setIsPreviewModalOpen(true);
          } catch (err) {
            showNotify('error', '檔案格式錯誤或已損壞。');
          }
        }
      };
      reader.readAsText(file);
    }
    e.target.value = '';
  };

  const handleConfirmImport = () => {
    if (!previewContent) return;
    const success = importData(previewContent.raw);
    if (success) {
      showNotify('success', '匯入成功！即將重新整理頁面...');
      setTimeout(() => window.location.reload(), 1000);
    } else {
      showNotify('error', '匯入失敗，請檢查檔案。');
      setIsPreviewModalOpen(false);
      setPreviewContent(null);
    }
  };

  const handleReset = () => {
    if (confirm("確定要重置系統嗎？所有資料都會被刪除。")) {
        clearAllData();
        setGoogleClientId('');
        setIsDriveConnected(false);
        onDataChange();
        showNotify('success', '系統已重置。');
    }
  };

  return (
    <div className="space-y-8 animate-fade-in relative pb-20">
      <div>
         <h2 className="text-2xl font-bold mb-2 text-white">系統設定</h2>
         <p className="text-slate-400">管理 API 金鑰、雲端同步與資料安全性。</p>
      </div>

      {notification && (
        <div className={`p-4 rounded-xl border flex items-start gap-3 shadow-lg animate-fade-in sticky top-4 z-50 ${notification.type === 'success' ? 'bg-emerald-500/10 border-emerald-500/50 text-emerald-400' : 'bg-red-500/10 border-red-500/50 text-red-400'}`}>
            {notification.type === 'success' ? <CheckCircle2 size={24}/> : <AlertCircle size={24}/>}
            <div className="flex-1 pt-0.5">
                <p className="text-sm font-bold">{notification.message}</p>
            </div>
            <button onClick={() => setNotification(null)}><X size={16}/></button>
        </div>
      )}

      {/* API Settings */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-slate-800 to-slate-900/50">
          <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-4">
            <Key className="text-amber-400"/> API 金鑰設定
          </h3>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
              <div>
                  <label className="text-sm text-slate-300 mb-2 block">FinMind API Token</label>
                  <div className="flex gap-2">
                      <Input type="password" value={finmindToken} onChange={(e) => setFinmindToken(e.target.value)} placeholder="輸入 FinMind Token" className="font-mono text-sm bg-black/30" />
                      <Button onClick={handleSaveFinMindToken} variant="secondary" className="shrink-0">儲存</Button>
                  </div>
                                      <p className="text-xs text-slate-500 mt-2">用於取得外資、投信等籌碼資料。若不輸入預設使用免費 Token 額度 (每小時 300 次)</p>
                    {apiUsage && (
                        <div className="mt-4 p-3 bg-slate-900/50 rounded-lg border border-slate-700">
                            <h4 className="text-sm font-bold text-slate-300 mb-2">API 使用量 (每小時重置)</h4>
                            <div className="flex justify-between items-center text-xs">
                                <span className="text-slate-400">目前用量</span>
                                <span className={`font-mono ${apiUsage.user_count >= apiUsage.api_request_limit * 0.8 ? "text-red-400" : "text-emerald-400"}`}>
                                    {apiUsage.user_count} / {apiUsage.api_request_limit}
                                </span>
                            </div>
                        </div>
                    )}
              </div>
          </div>
      </Card>

      <Card>
        <h3 className="text-lg font-bold mb-4 flex items-center gap-2 text-white"><History className="text-amber-500"/> 本地資料管理</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <Button onClick={exportData} variant="secondary" className="w-full text-xs"><Download size={16} className="mr-2"/> 匯出 JSON 備份</Button>
            <div className="relative">
                <input type="file" onChange={handleImportFileSelect} accept=".json" className="absolute inset-0 w-full h-full opacity-0 cursor-pointer" />
                <Button variant="secondary" className="w-full text-xs" as="div"><Upload size={16} className="mr-2"/> 匯入備份還原</Button>
            </div>
        </div>
        <div className="mt-6 pt-6 border-t border-slate-700"><Button onClick={handleReset} variant="danger" className="w-full text-[10px] uppercase font-bold"><Trash2 size={16} className="mr-2"/> 重置並清除所有本地資料</Button></div>
      </Card>

      {/* Google Drive Sync */}
      <Card>
          <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <Cloud className="text-blue-400"/> Google Drive 雲端同步
              </h3>
              {isDriveConnected && (
                  <span className="bg-emerald-500/20 text-emerald-400 text-[10px] px-2 py-1 rounded-full border border-emerald-500/30 flex items-center gap-1">
                      <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></div> 已連線
                  </span>
              )}
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-4">
              <div className="text-sm text-slate-400">
                  <p className="mb-4">將所有帳務資料備份至您的私人雲端 (Google Drive)，解決跨裝置同步需求。</p>
                  
                  <div className="space-y-2">
                      <label className="block text-xs font-medium text-slate-500 uppercase tracking-wider">OAuth Client ID</label>
                      <div className="flex gap-2">
                          <Input type="text" value={googleClientId} onChange={(e) => setGoogleClientId(e.target.value)} placeholder="輸入 Google Cloud Client ID" className="font-mono text-xs bg-black/30" />
                          <Button onClick={handleSaveClientId} variant="secondary" className="shrink-0 h-10 px-3">儲存</Button>
                      </div>
                      <p className="text-[10px] text-slate-600">* 請在 Google Cloud Console 設定授權來源 (Javascript Origins)。</p>
                  </div>
              </div>

              <div className="flex flex-col md:flex-row gap-3 pt-2">
                  <Button onClick={handleConnectDrive} disabled={isDriveLoading || (isDriveConnected && checkConnection())} className={`flex-1 ${isDriveConnected ? 'bg-emerald-600/50 cursor-default' : 'bg-blue-600'}`}>
                      {isDriveLoading ? <RefreshCw className="animate-spin" size={18}/> : isDriveConnected ? <CheckCircle2 size={18}/> : <LogIn size={18}/>}
                      {isDriveConnected ? '雲端服務已就緒' : '連接 Google 帳號'}
                  </Button>
                  {isDriveConnected && (<><Button onClick={handleBackupToDrive} disabled={isDriveLoading} variant="secondary" className="flex-1"><Upload size={18} className="mr-2"/> 雲端備份</Button><Button onClick={handleRestoreFromDrive} disabled={isDriveLoading} variant="secondary" className="flex-1"><Cloud size={18} className="mr-2"/> 雲端還原</Button></>)}
              </div>
          </div>
      </Card>

      {/* Investment Settings */}
      <Card className="border-cyan-500/30 bg-gradient-to-br from-slate-800 to-slate-900/50">
          <h3 className="text-lg font-bold flex items-center gap-2 text-white mb-4">
            <Sparkles className="text-cyan-400"/> 投資設定
          </h3>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-6">
              <div>
                  <label className="text-sm text-slate-300 mb-2 block">股票手續費折扣</label>
                  <div className="flex gap-2">
                      <div className="relative flex-1">
                           <Input type="number" step="0.01" value={feeDiscount} onChange={(e) => setFeeDiscount(Number(e.target.value))} placeholder="例如: 0.28" className="pl-9 font-mono text-sm bg-black/30" />
                           <Percent size={16} className="absolute left-3 top-3 text-slate-500"/>
                      </div>
                      <Button onClick={handleSaveFeeDiscount} variant="secondary" className="shrink-0">儲存</Button>
                  </div>
                  <p className="text-xs text-slate-500 mt-2">請輸入您的券商折扣，例如 2.8 折請輸入 0.28。此設定將影響損益計算的準確性。</p>
              </div>
          </div>
      </Card>

      {/* Technical Parameters Settings */}
      <Card className="border-indigo-500/30 bg-gradient-to-br from-slate-800 to-slate-900/50">
          <div className="flex justify-between items-start mb-4">
              <h3 className="text-lg font-bold flex items-center gap-2 text-white">
                <SettingsIcon className="text-indigo-400"/> 技術面參數設定
              </h3>
              <div className="flex gap-2">
                  <Button onClick={handleResetTechParams} variant="danger" className="text-xs h-8 px-3">還原預設</Button>
                  <Button onClick={handleSaveTechParams} variant="secondary" className="text-xs h-8 px-3">儲存參數</Button>
              </div>
          </div>
          <div className="bg-slate-900/50 p-4 rounded-xl border border-slate-700/50 space-y-6">
              <p className="text-xs text-slate-400">自定義 V3.0 量化評分引擎的買賣門檻，參數調整後將立即影響首頁的選股掃描結果。</p>
              
              <div className="overflow-x-auto pb-2">
                  <div className="min-w-[700px]">
                      {/* Header */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 mb-3 px-4">
                          <div className="font-bold text-slate-500 text-sm flex items-center">訊號燈號</div>
                          <div className="font-bold text-emerald-400 text-center bg-slate-900/50 py-2 rounded-lg border border-emerald-500/20">🟢 ETF</div>
                          <div className="font-bold text-blue-400 text-center bg-slate-900/50 py-2 rounded-lg border border-blue-500/20">🔵 上市（TSE）</div>
                          <div className="font-bold text-purple-400 text-center bg-slate-900/50 py-2 rounded-lg border border-purple-500/20">🟣 上櫃（OTC）</div>
                      </div>

                      {/* Chip Setup Row */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 bg-slate-900/30 rounded-xl border border-indigo-500/30 mb-3 hover:bg-slate-900/50 transition-colors">
                          <div className="font-bold text-indigo-400 flex flex-col justify-center">
                              <span>📊 籌碼參數</span>
                              <span className="text-[10px] text-slate-500 font-normal mt-1">DSS 第二軌共振</span>
                          </div>
                          
                          {/* All categories share same chip settings */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-indigo-500/10 col-span-3 grid grid-cols-2 gap-4">
                              <div className="flex flex-col gap-1">
                                  <label className="text-[11px] text-slate-400">法人累積買賣超天數 (預設3天)</label>
                                  <Input type="number" value={techParams.chipInstDays} onChange={e => setTechParams({...techParams, chipInstDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" />
                              </div>
                              <div className="flex flex-col gap-1">
                                  <label className="text-[11px] text-slate-400">融資增減基期天數 (預設5天)</label>
                                  <Input type="number" value={techParams.chipMarginDays} onChange={e => setTechParams({...techParams, chipMarginDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" />
                              </div>
                          </div>
                      </div>

                      {/* Row 1: 🟢 買進 */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/30 mb-3 hover:bg-slate-900/50 transition-colors">
                          <div className="font-bold text-emerald-400 flex flex-col justify-center">
                              <span>🟢 買進 (Buy)</span>
                              <span className="text-[10px] text-slate-500 font-normal mt-1">首次止跌反轉</span>
                          </div>
                          
                          {/* ETF Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.etfBuyBias} onChange={e => setTechParams({...techParams, etfBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.etfBuyRsi} onChange={e => setTechParams({...techParams, etfBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.etfBuySlopeDays} onChange={e => setTechParams({...techParams, etfBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                          
                          {/* Large Cap Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.largeCapBuyBias} onChange={e => setTechParams({...techParams, largeCapBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.largeCapBuyRsi} onChange={e => setTechParams({...techParams, largeCapBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.largeCapBuySlopeDays} onChange={e => setTechParams({...techParams, largeCapBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>

                          {/* Small Cap Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.smallCapBuyBias} onChange={e => setTechParams({...techParams, smallCapBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.smallCapBuyRsi} onChange={e => setTechParams({...techParams, smallCapBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.smallCapBuySlopeDays} onChange={e => setTechParams({...techParams, smallCapBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                      </div>

                      {/* Row 2: 🚀 強買 */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/30 mb-3 hover:bg-slate-900/50 transition-colors">
                          <div className="font-bold text-emerald-400 flex flex-col justify-center">
                              <span>🚀 強買 (Strong)</span>
                              <span className="text-[10px] text-slate-500 font-normal mt-1">深跌且確認反轉</span>
                          </div>
                          
                          {/* ETF Strong Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-emerald-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.etfStrongBuyBias} onChange={e => setTechParams({...techParams, etfStrongBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.etfStrongBuyRsi} onChange={e => setTechParams({...techParams, etfStrongBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.etfStrongBuySlopeDays} onChange={e => setTechParams({...techParams, etfStrongBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                          
                          {/* Large Cap Strong Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-emerald-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.largeCapStrongBuyBias} onChange={e => setTechParams({...techParams, largeCapStrongBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.largeCapStrongBuyRsi} onChange={e => setTechParams({...techParams, largeCapStrongBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.largeCapStrongBuySlopeDays} onChange={e => setTechParams({...techParams, largeCapStrongBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>

                          {/* Small Cap Strong Buy */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-emerald-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">乖離率 (&lt;= %)</label><Input type="number" value={techParams.smallCapStrongBuyBias} onChange={e => setTechParams({...techParams, smallCapStrongBuyBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">RSI (&lt;)</label><Input type="number" value={techParams.smallCapStrongBuyRsi} onChange={e => setTechParams({...techParams, smallCapStrongBuyRsi: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連增天)</label><Input type="number" value={techParams.smallCapStrongBuySlopeDays} onChange={e => setTechParams({...techParams, smallCapStrongBuySlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                      </div>

                      {/* Row 4: 🟡 停利 / 減碼 */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 bg-slate-900/30 rounded-xl border border-slate-700/30 mb-3 hover:bg-slate-900/50 transition-colors">
                          <div className="font-bold text-amber-400 flex flex-col justify-center">
                              <span>🟡 停利/減碼</span>
                              <span className="text-[10px] text-slate-500 font-normal mt-1">短線獲利入袋</span>
                              <span className="text-[10px] text-amber-500/60 font-normal mt-1">同時作為選股「過熱勿追」門檻</span>
                          </div>
                          
                          {/* ETF Partial Sell */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-amber-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">減碼乖離 (&gt;= %)</label><Input type="number" value={techParams.etfPartialSellBias} onChange={e => setTechParams({...techParams, etfPartialSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">再次減碼 (&gt;= %)</label><Input type="number" value={techParams.etfSecondPartialSellBias} onChange={e => setTechParams({...techParams, etfSecondPartialSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連降天)</label><Input type="number" value={techParams.etfPartialSellSlopeDays} onChange={e => setTechParams({...techParams, etfPartialSellSlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                          
                          {/* Large Cap Partial Sell */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-amber-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">停利乖離 (&gt;= %)</label><Input type="number" value={techParams.largeCapPartialSellBias} onChange={e => setTechParams({...techParams, largeCapPartialSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400 text-red-400/80">強制停利 (&gt;= %)</label><Input type="number" value={techParams.largeCapForceSellBias} onChange={e => setTechParams({...techParams, largeCapForceSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-red-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連降天)</label><Input type="number" value={techParams.largeCapPartialSellSlopeDays} onChange={e => setTechParams({...techParams, largeCapPartialSellSlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>

                          {/* Small Cap Partial Sell */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg border border-amber-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">停利乖離 (&gt;= %)</label><Input type="number" value={techParams.smallCapPartialSellBias} onChange={e => setTechParams({...techParams, smallCapPartialSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400 text-red-400/80">強制停利 (&gt;= %)</label><Input type="number" value={techParams.smallCapForceSellBias} onChange={e => setTechParams({...techParams, smallCapForceSellBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-red-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-slate-400">斜率(連降天)</label><Input type="number" value={techParams.smallCapPartialSellSlopeDays} onChange={e => setTechParams({...techParams, smallCapPartialSellSlopeDays: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50" /></div>
                          </div>
                      </div>

                      {/* Row 5: ⚠️ 停損 */}
                      <div className="grid grid-cols-[140px_1fr_1fr_1fr] gap-4 p-4 bg-slate-900/30 rounded-xl border border-rose-900/30 hover:bg-slate-900/50 transition-colors">
                          <div className="font-bold text-rose-400 flex flex-col justify-center">
                              <span>⚠️ 停損 (Stop Loss)</span>
                              <span className="text-[10px] text-slate-500 font-normal mt-1">強制控制風險</span>
                          </div>
                          
                          {/* ETF Stop Loss */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg flex items-center justify-center text-slate-600 text-xs border border-slate-700/50">
                              ETF 不停損
                          </div>
                          
                          {/* Large Cap Stop Loss */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg flex flex-col justify-center border border-rose-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-rose-400">持倉損益 (&lt;= %)</label><Input type="number" value={techParams.largeCapStopLossPnL} onChange={e => setTechParams({...techParams, largeCapStopLossPnL: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-rose-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-rose-400">停損乖離 (&lt;= %)</label><Input type="number" value={techParams.largeCapStopLossBias} onChange={e => setTechParams({...techParams, largeCapStopLossBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-rose-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-amber-400">風險乖離 (&lt;= %)</label><Input type="number" value={techParams.largeCapRiskAlertBias} onChange={e => setTechParams({...techParams, largeCapRiskAlertBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-amber-400" /></div>
                          </div>

                          {/* Small Cap Stop Loss */}
                          <div className="space-y-2 bg-black/20 p-3 rounded-lg flex flex-col justify-center border border-rose-500/10">
                              <div className="flex justify-between items-center"><label className="text-[11px] text-rose-400">持倉損益 (&lt;= %)</label><Input type="number" value={techParams.smallCapStopLossPnL} onChange={e => setTechParams({...techParams, smallCapStopLossPnL: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-rose-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-rose-400">停損乖離 (&lt;= %)</label><Input type="number" value={techParams.smallCapStopLossBias} onChange={e => setTechParams({...techParams, smallCapStopLossBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-rose-400" /></div>
                              <div className="flex justify-between items-center"><label className="text-[11px] text-amber-400">風險乖離 (&lt;= %)</label><Input type="number" value={techParams.smallCapRiskAlertBias} onChange={e => setTechParams({...techParams, smallCapRiskAlertBias: Number(e.target.value)})} className="h-7 w-24 text-xs bg-black/50 text-amber-400" /></div>
                          </div>
                      </div>
                  </div>
              </div>
          </div>
      </Card>




      {/* DSS 設定檔 */}
      <DSSProfilesCard onApply={(p) => {
          const cur = getTechParameters();
          const next = { ...cur };
          if (p.categories.ETF) {
              next.etfBuyRsi   = p.categories.ETF.rsi;
              next.etfBuyBias  = p.categories.ETF.bias20;
              if (p.categories.ETF.slopeUpDays !== undefined) next.etfBuySlopeDays = p.categories.ETF.slopeUpDays;
              if (p.categories.ETF.exitBias20 !== undefined) next.etfPartialSellBias = p.categories.ETF.exitBias20;
              if (p.categories.ETF.strongRsi !== undefined) next.etfStrongBuyRsi = p.categories.ETF.strongRsi;
              if (p.categories.ETF.strongBias20 !== undefined) next.etfStrongBuyBias = p.categories.ETF.strongBias20;
              if (p.categories.ETF.strongSlopeUpDays !== undefined) next.etfStrongBuySlopeDays = p.categories.ETF.strongSlopeUpDays;
              if (p.categories.ETF.exitForceBias20 !== undefined) next.etfSecondPartialSellBias = p.categories.ETF.exitForceBias20;
              // ETF 無停損機制（視為長線持有），STOP LOSS / FORCE STOP LOSS 不套用
          }
          if (p.categories['上市']) {
              next.largeCapBuyRsi  = p.categories['上市'].rsi;
              next.largeCapBuyBias = p.categories['上市'].bias20;
              if (p.categories['上市'].slopeUpDays !== undefined) next.largeCapBuySlopeDays = p.categories['上市'].slopeUpDays;
              if (p.categories['上市'].exitBias20 !== undefined) next.largeCapPartialSellBias = p.categories['上市'].exitBias20;
              if (p.categories['上市'].strongRsi !== undefined) next.largeCapStrongBuyRsi = p.categories['上市'].strongRsi;
              if (p.categories['上市'].strongBias20 !== undefined) next.largeCapStrongBuyBias = p.categories['上市'].strongBias20;
              if (p.categories['上市'].strongSlopeUpDays !== undefined) next.largeCapStrongBuySlopeDays = p.categories['上市'].strongSlopeUpDays;
              if (p.categories['上市'].exitForceBias20 !== undefined) next.largeCapForceSellBias = p.categories['上市'].exitForceBias20;
              if (p.categories['上市'].stopLossBias20 !== undefined) next.largeCapStopLossBias = p.categories['上市'].stopLossBias20;
          }
          if (p.categories['上櫃']) {
              next.smallCapBuyRsi  = p.categories['上櫃'].rsi;
              next.smallCapBuyBias = p.categories['上櫃'].bias20;
              if (p.categories['上櫃'].slopeUpDays !== undefined) next.smallCapBuySlopeDays = p.categories['上櫃'].slopeUpDays;
              if (p.categories['上櫃'].exitBias20 !== undefined) next.smallCapPartialSellBias = p.categories['上櫃'].exitBias20;
              if (p.categories['上櫃'].strongRsi !== undefined) next.smallCapStrongBuyRsi = p.categories['上櫃'].strongRsi;
              if (p.categories['上櫃'].strongBias20 !== undefined) next.smallCapStrongBuyBias = p.categories['上櫃'].strongBias20;
              if (p.categories['上櫃'].strongSlopeUpDays !== undefined) next.smallCapStrongBuySlopeDays = p.categories['上櫃'].strongSlopeUpDays;
              if (p.categories['上櫃'].exitForceBias20 !== undefined) next.smallCapForceSellBias = p.categories['上櫃'].exitForceBias20;
              if (p.categories['上櫃'].stopLossBias20 !== undefined) next.smallCapStopLossBias = p.categories['上櫃'].stopLossBias20;
          }
          saveTechParameters(next);
          setTechParams(next);
          triggerRescan();
      }} />

      <div className="text-center text-[10px] text-slate-600 pb-4">
          <p>FinTrack AI</p>
      </div>

      <Modal isOpen={isPreviewModalOpen} onClose={() => setIsPreviewModalOpen(false)} title="匯入預覽">
        {previewContent && (
            <div className="space-y-4">
                <div className="bg-slate-900/50 p-3 rounded-lg border border-slate-700 text-xs">
                    <p className="text-slate-300">備份時間：<span className="font-mono text-white">{previewContent.metadata?.backupDate ? new Date(previewContent.metadata.backupDate).toLocaleString() : 'N/A'}</span></p>
                    <p className="text-slate-400">備份版本：<span className="font-mono text-white">{previewContent.metadata?.appVersion || 'N/A'}</span></p>
                </div>
                <div className="bg-amber-500/10 p-3 rounded-lg border border-amber-500/30 text-xs text-amber-300 flex items-start gap-2">
                    <AlertCircle size={20}/><span><span className="font-bold">警告</span>: 匯入將會完全覆蓋您目前在此裝置上的所有資料，此操作無法復原。</span>
                </div>
                <h4 className="font-bold text-sm text-slate-200 pt-2">偵測到的資料摘要：</h4>
                <div className="grid grid-cols-2 gap-3 text-sm">
                    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><PieChart size={20} className="text-emerald-400"/><span>資產</span><span className="ml-auto font-mono font-bold text-white">{previewContent.stats.assets}</span></div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><TrendingUp size={20} className="text-violet-400"/><span>股票庫存</span><span className="ml-auto font-mono font-bold text-white">{previewContent.stats.stocks}</span></div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><ScrollText size={20} className="text-amber-400"/><span>交易紀錄</span><span className="ml-auto font-mono font-bold text-white">{previewContent.stats.transactions}</span></div>
                    <div className="flex items-center gap-3 p-3 bg-slate-800 rounded-lg"><CalendarClock size={20} className="text-cyan-400"/><span>固定收支</span><span className="ml-auto font-mono font-bold text-white">{previewContent.stats.recurring}</span></div>
                </div>
                <div className="flex gap-2 pt-4 border-t border-slate-700">
                    <Button variant="secondary" onClick={() => setIsPreviewModalOpen(false)} className="flex-1">取消</Button>
                    <Button onClick={handleConfirmImport} className="flex-1">確認覆蓋並匯入</Button>
                </div>
            </div>
        )}
      </Modal>

    </div>
  );
};






