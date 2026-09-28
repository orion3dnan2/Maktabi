import { Platform } from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { File, Paths } from 'expo-file-system';
import * as Sharing from 'expo-sharing';
import { newId } from '@/data/repositories';
import type { Attachment } from '@/data/workflow';

export async function pickAttachment(): Promise<Attachment | undefined> {
  const result = await DocumentPicker.getDocumentAsync({ type: ['application/pdf', 'image/*', 'text/plain', 'application/msword', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document'], copyToCacheDirectory: true, base64: true });
  if (result.canceled) return;
  const asset = result.assets[0]!;
  if ((asset.size ?? 0) > 1024 * 1024) throw new Error('الحد الأقصى للمستند 1 ميجابايت');
  const mimeType = asset.mimeType || 'application/octet-stream';
  const dataUri = Platform.OS === 'web' ? asset.base64! : `data:${mimeType};base64,${await new File(asset.uri).base64()}`;
  return { id: newId(), title: asset.name, name: asset.name, mimeType, dataUri, date: new Date().toISOString() };
}
export async function downloadAttachment(doc: Attachment) {
  if (Platform.OS === 'web') {
    const link = document.createElement('a'); link.href = doc.dataUri; link.download = doc.name; document.body.appendChild(link); link.click(); link.remove();
  } else {
    const file = new File(Paths.cache, `${doc.id}-${doc.name.replace(/[^\w.\u0600-\u06FF-]/g, '_')}`);
    file.write(doc.dataUri.split(',')[1]!, { encoding: 'base64' });
    if (!(await Sharing.isAvailableAsync())) throw new Error('مشاركة الملفات غير متاحة على هذا الجهاز');
    await Sharing.shareAsync(file.uri, { mimeType: doc.mimeType });
  }
}
