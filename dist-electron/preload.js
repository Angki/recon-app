let electron = require("electron");
//#region electron/preload.ts
electron.ipcRenderer.setMaxListeners(50);
electron.contextBridge.exposeInMainWorld("api", {
	startScan: (targetUrl, config) => electron.ipcRenderer.invoke("scan:start", targetUrl, config),
	stopScan: (scanId) => electron.ipcRenderer.invoke("scan:stop", scanId),
	onScanOutput: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("scan:output", handler);
		return () => {
			electron.ipcRenderer.removeListener("scan:output", handler);
		};
	},
	onScanStatus: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("scan:status", handler);
		return () => {
			electron.ipcRenderer.removeListener("scan:status", handler);
		};
	},
	onScanFindings: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("scan:findings", handler);
		return () => {
			electron.ipcRenderer.removeListener("scan:findings", handler);
		};
	},
	onScanStats: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("scan:stats", handler);
		return () => {
			electron.ipcRenderer.removeListener("scan:stats", handler);
		};
	},
	onScanEndpointsDiscovered: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("scan:endpoints-discovered", handler);
		return () => {
			electron.ipcRenderer.removeListener("scan:endpoints-discovered", handler);
		};
	},
	getEndpoints: (scanId, options) => electron.ipcRenderer.invoke("inventory:list", scanId, options),
	prepareTestingWorkflow: (reference, tool) => electron.ipcRenderer.invoke("inventory:prepare", reference, tool),
	getWorkflowRuns: (scanId) => electron.ipcRenderer.invoke("inventory:runs", scanId),
	getHistory: () => electron.ipcRenderer.invoke("storage:getHistory"),
	getFindingsPaginated: (scanId, options) => electron.ipcRenderer.invoke("storage:getFindingsPaginated", scanId, options),
	openReportFolder: (scanId) => electron.ipcRenderer.invoke("storage:openFolder", scanId),
	deleteScan: (scanId) => electron.ipcRenderer.invoke("storage:deleteScan", scanId),
	clearAllScans: () => electron.ipcRenderer.invoke("storage:clearAllScans"),
	exportReport: (scanId, format) => electron.ipcRenderer.invoke("report:export", scanId, format),
	getReportStats: (scanId) => electron.ipcRenderer.invoke("report:getStats", scanId),
	getSettings: () => electron.ipcRenderer.invoke("settings:get"),
	saveSettings: (settings) => electron.ipcRenderer.invoke("settings:save", settings),
	analyzeLogs: (logs, prompt) => electron.ipcRenderer.invoke("ai:analyzeLogs", logs, prompt),
	getOllamaModels: (customBaseUrl) => electron.ipcRenderer.invoke("ai:getOllamaModels", customBaseUrl),
	testAiConnection: (provider, customBaseUrl) => electron.ipcRenderer.invoke("ai:testConnection", provider, customBaseUrl),
	analyzeScan: (scanId, preset, customPrompt) => electron.ipcRenderer.invoke("ai:analyzeScan", scanId, preset, customPrompt),
	chatCopilot: (scanId, history, message) => electron.ipcRenderer.invoke("ai:chatCopilot", scanId, history, message),
	getAiAnalyses: (scanId) => electron.ipcRenderer.invoke("ai:getAnalyses", scanId),
	getLatestAiAnalysis: (scanId, preset) => electron.ipcRenderer.invoke("ai:getLatestAnalysis", scanId, preset),
	onAiProgress: (callback) => {
		const handler = (_event, msg) => callback(null, msg);
		electron.ipcRenderer.on("ai:progress", handler);
		return () => {
			electron.ipcRenderer.removeListener("ai:progress", handler);
		};
	},
	getToolsHealth: () => electron.ipcRenderer.invoke("tools:get-health"),
	updateTool: (toolName) => electron.ipcRenderer.invoke("tools:update-single", toolName),
	updateAllTools: () => electron.ipcRenderer.invoke("tools:update-all"),
	preflightSmoke: (toolId) => electron.ipcRenderer.invoke("tools:preflight-smoke", toolId),
	rollbackTool: (toolName) => electron.ipcRenderer.invoke("tools:rollback", toolName),
	uninstallTool: (toolName) => electron.ipcRenderer.invoke("tools:uninstall", toolName),
	isToolLocked: (toolName) => electron.ipcRenderer.invoke("tools:is-locked", toolName),
	onToolUpdateProgress: (callback) => {
		const handler = (_event, data) => callback(null, data);
		electron.ipcRenderer.on("tools:update-progress", handler);
		return () => {
			electron.ipcRenderer.removeListener("tools:update-progress", handler);
		};
	},
	onToolUpdateStatus: (callback) => {
		const handler = (_event, status) => callback(null, status);
		electron.ipcRenderer.on("tools:update-status", handler);
		return () => {
			electron.ipcRenderer.removeListener("tools:update-status", handler);
		};
	},
	checkDependencies: () => electron.ipcRenderer.invoke("dependency:check"),
	installDependencies: () => electron.ipcRenderer.invoke("dependency:installAll"),
	onInstallProgress: (callback) => {
		const handler = (_event, msg) => callback(null, msg);
		electron.ipcRenderer.on("dependency:installProgress", handler);
		return () => {
			electron.ipcRenderer.removeListener("dependency:installProgress", handler);
		};
	},
	updateTools: () => electron.ipcRenderer.invoke("tools:update"),
	onUpdateOutput: (callback) => {
		const handler = (_event, msg) => callback(null, msg);
		electron.ipcRenderer.on("update:output", handler);
		return () => {
			electron.ipcRenderer.removeListener("update:output", handler);
		};
	},
	onUpdateStatus: (callback) => {
		const handler = (_event, status) => callback(null, status);
		electron.ipcRenderer.on("update:status", handler);
		return () => {
			electron.ipcRenderer.removeListener("update:status", handler);
		};
	},
	openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url),
	getDiagnostics: () => electron.ipcRenderer.invoke("system:getDiagnostics"),
	getRecentLogs: (maxLines) => electron.ipcRenderer.invoke("system:getRecentLogs", maxLines),
	createBackup: () => electron.ipcRenderer.invoke("db:createBackup"),
	listBackups: () => electron.ipcRenderer.invoke("db:listBackups"),
	enforceRetention: (maxDays, maxTotalBytes) => electron.ipcRenderer.invoke("db:enforceRetention", maxDays, maxTotalBytes),
	importRawHttp: (rawText, defaultHost) => electron.ipcRenderer.invoke("workspace:importRawHttp", rawText, defaultHost),
	importHar: (harContent) => electron.ipcRenderer.invoke("workspace:importHar", harContent),
	importOpenApi: (specContent, defaultBaseUrl) => electron.ipcRenderer.invoke("workspace:importOpenApi", specContent, defaultBaseUrl),
	inspectParameters: (req) => electron.ipcRenderer.invoke("workspace:inspectParameters", req),
	buildToolPreview: (tool, req, authHeader) => electron.ipcRenderer.invoke("workspace:buildToolPreview", tool, req, authHeader),
	createAuthProfile: (params) => electron.ipcRenderer.invoke("auth:createProfile", params),
	validateAuthSession: (profileId) => electron.ipcRenderer.invoke("auth:validateSession", profileId),
	evaluateScopeUrl: (url, scope) => electron.ipcRenderer.invoke("scope:evaluateUrl", url, scope),
	getAppVersion: () => electron.ipcRenderer.invoke("app:getVersion")
});
//#endregion
