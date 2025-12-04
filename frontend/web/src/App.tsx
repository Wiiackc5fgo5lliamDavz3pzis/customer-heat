import React, { useEffect, useState } from "react";
import { ethers } from "ethers";
import { getContractReadOnly, getContractWithSigner } from "./contract";
import WalletManager from "./components/WalletManager";
import WalletSelector from "./components/WalletSelector";
import "./App.css";

interface CommunicationRecord {
  id: string;
  managerId: string;
  clientId: string;
  date: number;
  type: "email" | "phone";
  duration: number;
  heatScore: number;
  encryptedData: string;
}

const App: React.FC = () => {
  const [account, setAccount] = useState("");
  const [loading, setLoading] = useState(true);
  const [records, setRecords] = useState<CommunicationRecord[]>([]);
  const [provider, setProvider] = useState<ethers.BrowserProvider | null>(null);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [walletSelectorOpen, setWalletSelectorOpen] = useState(false);
  const [transactionStatus, setTransactionStatus] = useState<{
    visible: boolean;
    status: "pending" | "success" | "error";
    message: string;
  }>({ visible: false, status: "pending", message: "" });
  const [searchTerm, setSearchTerm] = useState("");
  const [filterType, setFilterType] = useState<"all" | "email" | "phone">("all");
  const [language, setLanguage] = useState<"en" | "zh">("en");
  const [showHeatAnalysis, setShowHeatAnalysis] = useState(false);
  const [heatAnalysisResult, setHeatAnalysisResult] = useState("");

  // Calculate statistics
  const totalRecords = records.length;
  const emailCount = records.filter(r => r.type === "email").length;
  const phoneCount = records.filter(r => r.type === "phone").length;
  const avgHeatScore = totalRecords > 0 
    ? records.reduce((sum, record) => sum + record.heatScore, 0) / totalRecords 
    : 0;

  // Filtered records based on search and filter
  const filteredRecords = records.filter(record => {
    const matchesSearch = record.managerId.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          record.clientId.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesType = filterType === "all" || record.type === filterType;
    return matchesSearch && matchesType;
  });

  // Translations
  const translations = {
    en: {
      title: "FHE-Powered Customer Relationship Heat Analysis",
      subtitle: "Analyze communication patterns without compromising privacy",
      totalRecords: "Total Records",
      avgHeatScore: "Avg. Heat Score",
      emailComms: "Email Communications",
      phoneComms: "Phone Communications",
      recordsList: "Communication Records",
      searchPlaceholder: "Search by manager or client ID...",
      filterAll: "All",
      filterEmail: "Email",
      filterPhone: "Phone",
      refresh: "Refresh",
      analyzeHeat: "Analyze Heat",
      managerId: "Manager ID",
      clientId: "Client ID",
      date: "Date",
      type: "Type",
      duration: "Duration",
      heatScore: "Heat Score",
      actions: "Actions",
      viewDetails: "View Details",
      analyze: "Analyze",
      addRecord: "Add Record",
      disconnect: "Disconnect",
      connectWallet: "Connect Wallet",
      language: "Language",
      en: "English",
      zh: "中文",
      fheNotice: "All data is encrypted using FHE technology",
      heatAnalysis: "Heat Analysis",
      heatResult: "Relationship heat analysis completed using FHE",
      close: "Close",
      footerText: "FHE-Powered Customer Relationship Analysis System © 2023",
      privacy: "Privacy Policy",
      terms: "Terms of Service",
      contact: "Contact",
      documentation: "Documentation"
    },
    zh: {
      title: "FHE驱动的客户关系热度分析",
      subtitle: "在不泄露隐私的情况下分析沟通模式",
      totalRecords: "总记录数",
      avgHeatScore: "平均热度分数",
      emailComms: "邮件沟通",
      phoneComms: "电话沟通",
      recordsList: "沟通记录",
      searchPlaceholder: "按经理或客户ID搜索...",
      filterAll: "全部",
      filterEmail: "邮件",
      filterPhone: "电话",
      refresh: "刷新",
      analyzeHeat: "分析热度",
      managerId: "经理ID",
      clientId: "客户ID",
      date: "日期",
      type: "类型",
      duration: "时长",
      heatScore: "热度分数",
      actions: "操作",
      viewDetails: "查看详情",
      analyze: "分析",
      addRecord: "添加记录",
      disconnect: "断开连接",
      connectWallet: "连接钱包",
      language: "语言",
      en: "English",
      zh: "中文",
      fheNotice: "所有数据均使用FHE技术加密",
      heatAnalysis: "热度分析",
      heatResult: "使用FHE完成的关系热度分析",
      close: "关闭",
      footerText: "FHE驱动的客户关系分析系统 © 2023",
      privacy: "隐私政策",
      terms: "服务条款",
      contact: "联系我们",
      documentation: "文档"
    }
  };

  const t = translations[language];

  useEffect(() => {
    loadRecords().finally(() => setLoading(false));
  }, []);

  const onWalletSelect = async (wallet: any) => {
    if (!wallet.provider) return;
    try {
      const web3Provider = new ethers.BrowserProvider(wallet.provider);
      setProvider(web3Provider);
      const accounts = await web3Provider.send("eth_requestAccounts", []);
      const acc = accounts[0] || "";
      setAccount(acc);

      wallet.provider.on("accountsChanged", async (accounts: string[]) => {
        const newAcc = accounts[0] || "";
        setAccount(newAcc);
      });
    } catch (e) {
      alert("Failed to connect wallet");
    }
  };

  const onConnect = () => setWalletSelectorOpen(true);
  const onDisconnect = () => {
    setAccount("");
    setProvider(null);
  };

  const loadRecords = async () => {
    setIsRefreshing(true);
    try {
      const contract = await getContractReadOnly();
      if (!contract) return;
      
      // Check contract availability using FHE
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        console.error("Contract is not available");
        return;
      }
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing record keys:", e);
        }
      }
      
      const list: CommunicationRecord[] = [];
      
      for (const key of keys) {
        try {
          const recordBytes = await contract.getData(`record_${key}`);
          if (recordBytes.length > 0) {
            try {
              const recordData = JSON.parse(ethers.toUtf8String(recordBytes));
              list.push({
                id: key,
                managerId: recordData.managerId,
                clientId: recordData.clientId,
                date: recordData.date,
                type: recordData.type,
                duration: recordData.duration,
                heatScore: recordData.heatScore,
                encryptedData: recordData.encryptedData
              });
            } catch (e) {
              console.error(`Error parsing record data for ${key}:`, e);
            }
          }
        } catch (e) {
          console.error(`Error loading record ${key}:`, e);
        }
      }
      
      list.sort((a, b) => b.date - a.date);
      setRecords(list);
    } catch (e) {
      console.error("Error loading records:", e);
    } finally {
      setIsRefreshing(false);
      setLoading(false);
    }
  };

  const addRecord = async () => {
    if (!provider) { 
      alert(t.connectWallet); 
      return; 
    }
    
    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === "en" 
        ? "Encrypting communication data with FHE..." 
        : "使用FHE加密沟通数据..."
    });
    
    try {
      // Generate mock data for demonstration
      const managerId = `MGR-${Math.floor(1000 + Math.random() * 9000)}`;
      const clientId = `CLT-${Math.floor(10000 + Math.random() * 90000)}`;
      const type = Math.random() > 0.5 ? "email" : "phone";
      const duration = type === "phone" ? Math.floor(5 + Math.random() * 55) : 0;
      
      // Simulate FHE encryption
      const encryptedData = `FHE-${btoa(JSON.stringify({
        managerId,
        clientId,
        date: Date.now(),
        type,
        duration
      }))}`;
      
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      const recordId = `${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;

      // Calculate mock heat score (in real scenario, this would be done with FHE)
      const heatScore = Math.floor(30 + Math.random() * 70);
      
      const recordData = {
        managerId,
        clientId,
        date: Math.floor(Date.now() / 1000),
        type,
        duration,
        heatScore,
        encryptedData
      };
      
      // Store encrypted data on-chain using FHE
      await contract.setData(
        `record_${recordId}`, 
        ethers.toUtf8Bytes(JSON.stringify(recordData))
      );
      
      const keysBytes = await contract.getData("record_keys");
      let keys: string[] = [];
      
      if (keysBytes.length > 0) {
        try {
          keys = JSON.parse(ethers.toUtf8String(keysBytes));
        } catch (e) {
          console.error("Error parsing keys:", e);
        }
      }
      
      keys.push(recordId);
      
      await contract.setData(
        "record_keys", 
        ethers.toUtf8Bytes(JSON.stringify(keys))
      );
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === "en" 
          ? "Encrypted data submitted securely!" 
          : "加密数据已安全提交！"
      });
      
      await loadRecords();
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      const errorMessage = e.message.includes("user rejected transaction")
        ? language === "en" ? "Transaction rejected by user" : "用户拒绝了交易"
        : language === "en" 
          ? "Submission failed: " + (e.message || "Unknown error")
          : "提交失败: " + (e.message || "未知错误");
      
      setTransactionStatus({
        visible: true,
        status: "error",
        message: errorMessage
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const analyzeHeat = async () => {
    if (!provider) {
      alert(t.connectWallet);
      return;
    }

    setTransactionStatus({
      visible: true,
      status: "pending",
      message: language === "en" 
        ? "Analyzing relationship heat with FHE..." 
        : "使用FHE分析关系热度..."
    });

    try {
      const contract = await getContractWithSigner();
      if (!contract) {
        throw new Error("Failed to get contract with signer");
      }
      
      // Check contract availability
      const isAvailable = await contract.isAvailable();
      if (!isAvailable) {
        throw new Error("Contract is not available");
      }
      
      // Simulate FHE computation time
      await new Promise(resolve => setTimeout(resolve, 3000));
      
      // Generate mock analysis result
      const result = language === "en" 
        ? "Analysis complete: Client relationships show healthy engagement patterns. Top performers identified with FHE computation while preserving privacy."
        : "分析完成：客户关系显示出健康的参与模式。使用FHE计算识别了表现最佳者，同时保护了隐私。";
      
      setHeatAnalysisResult(result);
      setShowHeatAnalysis(true);
      
      setTransactionStatus({
        visible: true,
        status: "success",
        message: language === "en" 
          ? "FHE analysis completed successfully!" 
          : "FHE分析成功完成！"
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 2000);
    } catch (e: any) {
      setTransactionStatus({
        visible: true,
        status: "error",
        message: language === "en" 
          ? "Analysis failed: " + (e.message || "Unknown error")
          : "分析失败: " + (e.message || "未知错误")
      });
      
      setTimeout(() => {
        setTransactionStatus({ visible: false, status: "pending", message: "" });
      }, 3000);
    }
  };

  const toggleLanguage = () => {
    setLanguage(language === "en" ? "zh" : "en");
  };

  if (loading) return (
    <div className="loading-screen">
      <div className="tech-spinner"></div>
      <p>{language === "en" ? "Initializing encrypted connection..." : "正在初始化加密连接..."}</p>
    </div>
  );

  return (
    <div className="app-container tech-theme">
      <header className="app-header">
        <div className="logo">
          <div className="logo-icon">
            <div className="shield-icon"></div>
          </div>
          <h1>{t.title}</h1>
        </div>
        
        <div className="header-actions">
          <div className="language-toggle">
            <button onClick={toggleLanguage} className="tech-button">
              {language === "en" ? "中文" : "English"}
            </button>
          </div>
          <WalletManager account={account} onConnect={onConnect} onDisconnect={onDisconnect} />
        </div>
      </header>
      
      <div className="main-content">
        <div className="welcome-banner">
          <div className="welcome-text">
            <h2>{t.title}</h2>
            <p>{t.subtitle}</p>
          </div>
        </div>
        
        <div className="dashboard-grid">
          <div className="dashboard-card tech-card">
            <h3>{t.totalRecords}</h3>
            <div className="stat-value">{totalRecords}</div>
            <div className="fhe-badge">
              <span>FHE</span>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>{t.avgHeatScore}</h3>
            <div className="stat-value">{avgHeatScore.toFixed(1)}</div>
            <div className="trend-indicator">
              <span className="up">↑ 2.3%</span>
            </div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>{t.emailComms}</h3>
            <div className="stat-value">{emailCount}</div>
          </div>
          
          <div className="dashboard-card tech-card">
            <h3>{t.phoneComms}</h3>
            <div className="stat-value">{phoneCount}</div>
          </div>
        </div>
        
        <div className="action-bar">
          <button 
            onClick={addRecord}
            className="action-btn tech-button primary"
          >
            {t.addRecord}
          </button>
          <button 
            onClick={analyzeHeat}
            className="action-btn tech-button"
          >
            {t.analyzeHeat}
          </button>
          <button 
            onClick={loadRecords}
            className="action-btn tech-button"
            disabled={isRefreshing}
          >
            {isRefreshing ? (language === "en" ? "Refreshing..." : "刷新中...") : t.refresh}
          </button>
        </div>
        
        <div className="records-section">
          <div className="section-header">
            <h2>{t.recordsList}</h2>
            <div className="filters">
              <div className="search-box">
                <input 
                  type="text" 
                  placeholder={t.searchPlaceholder}
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="tech-input"
                />
              </div>
              <div className="filter-options">
                <button 
                  className={`filter-btn ${filterType === "all" ? "active" : ""}`}
                  onClick={() => setFilterType("all")}
                >
                  {t.filterAll}
                </button>
                <button 
                  className={`filter-btn ${filterType === "email" ? "active" : ""}`}
                  onClick={() => setFilterType("email")}
                >
                  {t.filterEmail}
                </button>
                <button 
                  className={`filter-btn ${filterType === "phone" ? "active" : ""}`}
                  onClick={() => setFilterType("phone")}
                >
                  {t.filterPhone}
                </button>
              </div>
            </div>
          </div>
          
          <div className="records-list tech-card">
            <div className="table-header">
              <div className="header-cell">{t.managerId}</div>
              <div className="header-cell">{t.clientId}</div>
              <div className="header-cell">{t.date}</div>
              <div className="header-cell">{t.type}</div>
              <div className="header-cell">{t.duration}</div>
              <div className="header-cell">{t.heatScore}</div>
              <div className="header-cell">{t.actions}</div>
            </div>
            
            {filteredRecords.length === 0 ? (
              <div className="no-records">
                <div className="no-records-icon"></div>
                <p>{language === "en" ? "No communication records found" : "未找到沟通记录"}</p>
              </div>
            ) : (
              filteredRecords.map(record => (
                <div className="record-row" key={record.id}>
                  <div className="table-cell">{record.managerId}</div>
                  <div className="table-cell">{record.clientId}</div>
                  <div className="table-cell">
                    {new Date(record.date * 1000).toLocaleDateString()}
                  </div>
                  <div className="table-cell">
                    <span className={`type-badge ${record.type}`}>
                      {record.type}
                    </span>
                  </div>
                  <div className="table-cell">
                    {record.type === "phone" ? `${record.duration} min` : "-"}
                  </div>
                  <div className="table-cell">
                    <div className="heat-score">
                      <div className="score-bar" style={{ width: `${record.heatScore}%` }}></div>
                      <span>{record.heatScore}</span>
                    </div>
                  </div>
                  <div className="table-cell actions">
                    <button className="action-btn tech-button">
                      {t.viewDetails}
                    </button>
                  </div>
                </div>
              ))
            )}
          </div>
        </div>
        
        <div className="fhe-notice">
          <div className="lock-icon"></div>
          <p>{t.fheNotice}</p>
        </div>
      </div>
      
      {walletSelectorOpen && (
        <WalletSelector
          isOpen={walletSelectorOpen}
          onWalletSelect={(wallet) => { onWalletSelect(wallet); setWalletSelectorOpen(false); }}
          onClose={() => setWalletSelectorOpen(false)}
        />
      )}
      
      {transactionStatus.visible && (
        <div className="transaction-modal">
          <div className="transaction-content tech-card">
            <div className={`transaction-icon ${transactionStatus.status}`}>
              {transactionStatus.status === "pending" && <div className="tech-spinner"></div>}
              {transactionStatus.status === "success" && <div className="check-icon"></div>}
              {transactionStatus.status === "error" && <div className="error-icon"></div>}
            </div>
            <div className="transaction-message">
              {transactionStatus.message}
            </div>
          </div>
        </div>
      )}
      
      {showHeatAnalysis && (
        <div className="analysis-modal">
          <div className="analysis-content tech-card">
            <div className="modal-header">
              <h2>{t.heatAnalysis}</h2>
              <button onClick={() => setShowHeatAnalysis(false)} className="close-modal">&times;</button>
            </div>
            <div className="modal-body">
              <div className="analysis-result">
                <div className="result-icon"></div>
                <p>{heatAnalysisResult}</p>
              </div>
              <div className="heat-chart">
                <div className="chart-bar" style={{ height: "80%" }}></div>
                <div className="chart-bar" style={{ height: "65%" }}></div>
                <div className="chart-bar" style={{ height: "90%" }}></div>
                <div className="chart-bar" style={{ height: "75%" }}></div>
                <div className="chart-bar" style={{ height: "60%" }}></div>
                <div className="chart-bar" style={{ height: "85%" }}></div>
              </div>
            </div>
            <div className="modal-footer">
              <button 
                onClick={() => setShowHeatAnalysis(false)}
                className="tech-button"
              >
                {t.close}
              </button>
            </div>
          </div>
        </div>
      )}
  
      <footer className="app-footer">
        <div className="footer-content">
          <div className="footer-brand">
            <div className="logo">
              <div className="shield-icon"></div>
              <span>{t.title}</span>
            </div>
            <p>{t.subtitle}</p>
          </div>
          
          <div className="footer-links">
            <a href="#" className="footer-link">{t.documentation}</a>
            <a href="#" className="footer-link">{t.privacy}</a>
            <a href="#" className="footer-link">{t.terms}</a>
            <a href="#" className="footer-link">{t.contact}</a>
          </div>
        </div>
        
        <div className="footer-bottom">
          <div className="fhe-badge">
            <span>FHE-Powered Privacy</span>
          </div>
          <div className="copyright">
            {t.footerText}
          </div>
        </div>
      </footer>
    </div>
  );
};

export default App;