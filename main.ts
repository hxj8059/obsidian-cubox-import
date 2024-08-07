import { App, Editor, MarkdownView, Modal, Notice, Plugin, PluginSettingTab, Setting, TFile, Vault } from 'obsidian';
import JSZip from 'jszip';
import { writeFileSync, mkdirSync } from 'fs';
import axios from 'axios';
import { stringify } from 'querystring';

// Remember to rename these classes and interfaces!

interface CuboxImportSettings {
	myPath: string;
	mySetting: string;
	pageNum: string;
	sourceFolder: string;
}

const DEFAULT_SETTINGS: CuboxImportSettings = {
	myPath: "data/",
	mySetting: 'default',
	pageNum: "1",
	sourceFolder: "archived"
}

export default class CuboxImport extends Plugin {
	settings: CuboxImportSettings;

	async downloadAndExtract() {

		const settingValue = this.settings.mySetting;
		const settingPath = this.settings.myPath;
		const pageNum = this.settings.pageNum;
		let num: number = parseFloat(pageNum);
		const sourceFolder = this.settings.sourceFolder;
		console.log(settingValue);
		const cookies = {
			token: settingValue,
		};
		
		const headers = {
			'authority': 'cubox.pro',
			'accept': 'application/json, text/plain, */*',
			'accept-language': 'zh-CN,zh;q=0.9,en;q=0.8,en-GB;q=0.7,en-US;q=0.6',
			'authorization': settingValue,
			'content-type': 'application/x-www-form-urlencoded',
			'origin': 'https://cubox.pro',
			'referer': 'https://cubox.pro/my/archive/all',
			'sec-ch-ua': '"Microsoft Edge";v="119", "Chromium";v="119", "Not?A_Brand";v="24"',
			'sec-ch-ua-mobile': '?0',
			'sec-ch-ua-platform': '"macOS"',
			'sec-fetch-dest': 'empty',
			'sec-fetch-mode': 'cors',
			'sec-fetch-site': 'same-origin',
			'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/119.0.0.0 Safari/537.36 Edg/119.0.0.0',
		};

		const ls_params = {
			asc: 'false',
			page: pageNum,
			filters: '',
			archiving: 'true'
		}

		// const inbox_params = {
		// 	asc: 'false',
		// 	page: pageNum,
		// 	filters: '',
		// 	archiving: 'false'
		// }


		let ls_id:string;
		let url:string;
		let ids:string[]=[];
		if(sourceFolder == "archived") {
			url = 'https://cubox.pro/c/api/v2/search_engine/my';
		}else{
			url = 'https://cubox.pro/c/api/v2/search_engine/inbox';
			ls_params.archiving = "false";
		}
		for (let i = 1; i <= num; i++) {
			ls_params.page = i.toString()
			console.log(ls_params);
			try{ 
				const response = await axios.get(url, {
					params: ls_params,
					headers: headers
				});
				console.log(response.data);
				let id = response.data.data.map((item: any) => item.userSearchEngineID);
				ids = ids.concat(id)
				// const parsed = JSON.parse(response.data);
				// console.log(parsed)
				// const ids = parsed.data.map((item: any) => item.userSearchEngineID);
			}catch (error) {
				console.error('Error occurred:', error);
			}
		}
		ls_id = ids.join(",");
		console.log(ls_id)
		const data = {
			'engineIds': ls_id,
			'type': 'md',
			'snap': 'false',
			'compressed': 'true',
		};
		console.log(data)
		
		try {
			const response = await axios.post('https://cubox.pro/c/api/search_engines/export', data, {
				headers: headers,
				withCredentials: false,
				responseType: 'arraybuffer'
			});
	
			const jszip = new JSZip();
			const zip = await jszip.loadAsync(response.data);
	
			Object.keys(zip.files).forEach(async (filename) => {
				const fileData = await zip.files[filename].async('nodebuffer');
				const extractToPath = settingPath + filename;
				this.app.vault.create(extractToPath, fileData.toString());
				// mkdirSync('DATA/', { recursive: true }); // Ensure directory exists
				// writeFileSync(extractToPath, fileData);
			});
	
			console.log("解压完成！");
			new Notice('Cubox同步完成!');
		} catch (error) {
			console.error('Error occurred:', error);
		}
	}
	async onload() {
		await this.loadSettings();

		// This creates an icon in the left ribbon.
		const ribbonIconEl = this.addRibbonIcon('dice', 'sync cubox data', (evt: MouseEvent) => {
			// Called when the user clicks the icon.
			new Notice('开始同步！');
			this.downloadAndExtract();
		});
		// Perform additional things with the ribbon
		ribbonIconEl.addClass('my-plugin-ribbon-class');

		// This adds a status bar item to the bottom of the app. Does not work on mobile apps.
		const statusBarItemEl = this.addStatusBarItem();
		statusBarItemEl.setText('Status Bar Text');

		// This adds a simple command that can be triggered anywhere
		this.addCommand({
			id: 'sync-cubox',
			name: 'Cubox-import:Sync cubox data to obsidian vault',
			callback: () => {
				this.downloadAndExtract();
				// new SampleModal(this.app).open();
			}
		});
		// This adds an editor command that can perform some operation on the current editor instance
		this.addCommand({
			id: 'sample-editor-command',
			name: 'Sample editor command',
			editorCallback: (editor: Editor, view: MarkdownView) => {
				console.log(editor.getSelection());
				editor.replaceSelection('Sample Editor Command');
			}
		});
		// This adds a complex command that can check whether the current state of the app allows execution of the command
		this.addCommand({
			id: 'open-sample-modal-complex',
			name: 'Open sample modal (complex)',
			checkCallback: (checking: boolean) => {
				// Conditions to check
				const markdownView = this.app.workspace.getActiveViewOfType(MarkdownView);
				if (markdownView) {
					// If checking is true, we're simply "checking" if the command can be run.
					// If checking is false, then we want to actually perform the operation.
					if (!checking) {
						new SampleModal(this.app).open();
					}

					// This command will only show up in Command Palette when the check function returns true
					return true;
				}
			}
		});

		// This adds a settings tab so the user can configure various aspects of the plugin
		this.addSettingTab(new SettingTab(this.app, this));

		// If the plugin hooks up any global DOM events (on parts of the app that doesn't belong to this plugin)
		// Using this function will automatically remove the event listener when this plugin is disabled.
		this.registerDomEvent(document, 'click', (evt: MouseEvent) => {
			console.log('click', evt);
		});

		// When registering intervals, this function will automatically clear the interval when the plugin is disabled.
		this.registerInterval(window.setInterval(() => console.log('setInterval'), 5 * 60 * 1000));
	}

	onunload() {

	}

	async loadSettings() {
		this.settings = Object.assign({}, DEFAULT_SETTINGS, await this.loadData());
	}

	async saveSettings() {
		await this.saveData(this.settings);
	}
}

class SampleModal extends Modal {
	constructor(app: App) {
		super(app);
	}

	onOpen() {
		const {contentEl} = this;
		contentEl.setText('Woah!');
	}

	onClose() {
		const {contentEl} = this;
		contentEl.empty();
	}
}

class SettingTab extends PluginSettingTab {
	plugin: CuboxImport;

	constructor(app: App, plugin: CuboxImport) {
		super(app, plugin);
		this.plugin = plugin;
	}

	display(): void {
		const {containerEl} = this;

		containerEl.empty();

		new Setting(containerEl)
			.setName('Cubox token')
			.setDesc('The cubox token from website')
			.addText(text => text
				.setPlaceholder('Enter your token')
				.setValue(this.plugin.settings.mySetting)
				.onChange(async (value) => {
					this.plugin.settings.mySetting = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('File path')
			.setDesc('The path to store cubox markdowns')
			.addText(text => text
				.setPlaceholder('path/')
				.setValue(this.plugin.settings.myPath)
				.onChange(async (value) => {
					this.plugin.settings.myPath = value;
					await this.plugin.saveSettings();
				}));

		new Setting(containerEl)
			.setName('Sync page num')
			.setDesc('The number of pages to import')
			.addText(text => text
				.setPlaceholder('1')
				.setValue(this.plugin.settings.pageNum)
				.onChange(async (value) => {
					this.plugin.settings.pageNum = value;
					await this.plugin.saveSettings();
				}));
		
		new Setting(containerEl)
			.setName('Source folder')
			.setDesc('Select a folder to import')
			.addDropdown(dropdown => dropdown
				.addOption('archived', 'Archived')
				.addOption('inbox', 'Inbox')
				.setValue(this.plugin.settings.sourceFolder)
				.onChange(async (value) => {
					this.plugin.settings.sourceFolder = value;
					await this.plugin.saveSettings();
				}));
		
	}
}
