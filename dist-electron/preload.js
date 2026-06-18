let electron = require("electron");
//#region electron/preload.ts
electron.ipcRenderer.setMaxListeners(50);
electron.contextBridge.exposeInMainWorld("api", {
	startScan: (targetUrl, config) => electron.ipcRenderer.invoke("scan:start", targetUrl, config),
	stopScan: (scanId) => electron.ipcRenderer.invoke("scan:stop", scanId),
	onScanOutput: (callback) => {
		electron.ipcRenderer.on("scan:output", callback);
		return () => {
			electron.ipcRenderer.removeListener("scan:output", callback);
		};
	},
	onScanStatus: (callback) => {
		electron.ipcRenderer.on("scan:status", callback);
		return () => {
			electron.ipcRenderer.removeListener("scan:status", callback);
		};
	},
	onScanFindings: (callback) => {
		electron.ipcRenderer.on("scan:findings", callback);
		return () => {
			electron.ipcRenderer.removeListener("scan:findings", callback);
		};
	},
	onScanStats: (callback) => {
		electron.ipcRenderer.on("scan:stats", callback);
		return () => {
			electron.ipcRenderer.removeListener("scan:stats", callback);
		};
	},
	getHistory: () => electron.ipcRenderer.invoke("storage:getHistory"),
	openReportFolder: (scanId) => electron.ipcRenderer.invoke("storage:openFolder", scanId),
	getSettings: () => electron.ipcRenderer.invoke("settings:get"),
	saveSettings: (settings) => electron.ipcRenderer.invoke("settings:save", settings),
	analyzeLogs: (logs, prompt) => electron.ipcRenderer.invoke("ai:analyzeLogs", logs, prompt),
	onAiProgress: (callback) => {
		electron.ipcRenderer.on("ai:progress", callback);
		return () => {
			electron.ipcRenderer.removeListener("ai:progress", callback);
		};
	},
	updateTools: () => electron.ipcRenderer.invoke("tools:update"),
	onUpdateOutput: (callback) => {
		electron.ipcRenderer.on("update:output", callback);
		return () => {
			electron.ipcRenderer.removeListener("update:output", callback);
		};
	},
	onUpdateStatus: (callback) => {
		electron.ipcRenderer.on("update:status", callback);
		return () => {
			electron.ipcRenderer.removeListener("update:status", callback);
		};
	},
	openExternal: (url) => electron.ipcRenderer.invoke("shell:openExternal", url)
});
//#endregion
