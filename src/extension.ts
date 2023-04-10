// The module 'vscode' contains the VS Code extensibility API
// Import the module and reference it with the alias vscode in your code below
import * as vscode from 'vscode';
import { spawn } from 'child_process';
import { readFile } from 'fs/promises';
import * as path from 'path';

async function loadHTMLFile(context: vscode.ExtensionContext, relativePath: string) {
	const fileUri = vscode.Uri.joinPath(context.extensionUri, relativePath);
	const fileContents = await readFile(fileUri.fsPath, 'utf8');
	return fileContents;
}

function getTypstWsPath(): string {
	return vscode.workspace.getConfiguration().get<string>('typst-ws.executable') || 'typst-ws';
}

// This method is called when your extension is activated
// Your extension is activated the very first time the command is executed
export function activate(context: vscode.ExtensionContext) {

	// Use the console to output diagnostic information (console.log) and errors (console.error)
	// This line of code will only be executed once when your extension is activated
	console.log('Congratulations, your extension "typst-preview" is now active!');

	// The command has been defined in the package.json file
	// Now provide the implementation of the command with registerCommand
	// The commandId parameter must match the command field in package.json
	let disposable = vscode.commands.registerCommand('typst-preview.preview', async () => {
		// The code you place here will be executed every time your command is executed
		// Display a message box to the user
		let activeEditor = vscode.window.activeTextEditor;
		if (activeEditor) {
			let filePath = activeEditor.document.uri.fsPath;
			console.log('File path:', filePath);
			// get file dir using path
			let rootDir = path.dirname(filePath);
			let filename = path.basename(filePath);
			let shadowFilePath = path.join(rootDir, '.typst-preview.' + filename);
			console.log('shadow file path:', shadowFilePath);
			// copy file content to shadow file
			let fileContent = activeEditor.document.getText();
			await vscode.workspace.fs.writeFile(vscode.Uri.file(shadowFilePath), Buffer.from(fileContent));
			const update = async () => {
				// save file content to shadow file
				if (activeEditor?.document) {
					let fileContent = activeEditor?.document.getText();
					await vscode.workspace.fs.writeFile(vscode.Uri.file(shadowFilePath), Buffer.from(fileContent));
				}
			};
			vscode.workspace.onDidChangeTextDocument(async (e) => {
				if (e.document === activeEditor?.document) {
					await update();
				}
			});
			const serverProcess = spawn(getTypstWsPath(), ['watch', shadowFilePath]);
			serverProcess.stdout.on('data', (data) => {
				console.log(`${data}`);
			});

			serverProcess.stderr.on('data', (data) => {
				console.log(`${data}`);
			});

			serverProcess.on('exit', (code) => {
				console.log(`child process exited with code ${code}`);
			});
			console.log('Launched server');
			const webviewOptions = {
				enableScripts: true,
				enableWebsockets: true,
			};

			// Create and show a new WebView
			const panel = vscode.window.createWebviewPanel(
				'typst-ws-preview', // 标识符
				'Preview', // 面板标题
				vscode.ViewColumn.Beside, // 显示在编辑器的哪一侧
				{
					enableScripts: true, // 启用 JS
				}
			);

			panel.onDidDispose(async () => {
				serverProcess.kill();
				panel.dispose();
				// remove shadow file
				await vscode.workspace.fs.delete(vscode.Uri.file(shadowFilePath));
				console.log("killing preview service");
			});

			// 将已经准备好的 HTML 设置为 Webview 内容
			const html = await loadHTMLFile(context, './index.html');
			panel.webview.html = html;
		} else {
			vscode.window.showWarningMessage('No active editor');
		}
	});

	context.subscriptions.push(disposable);
}

// This method is called when your extension is deactivated
export function deactivate() { }
