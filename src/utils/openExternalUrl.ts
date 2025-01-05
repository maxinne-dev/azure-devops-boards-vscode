import * as vscode from 'vscode';

export const openExternalUrl = (url?: string) => {
  if (url) {
    vscode.env.openExternal(vscode.Uri.parse(url));
  } else {
    throw new Error('Empty URL');
  }
};
