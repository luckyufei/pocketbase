import path from 'path';
import { fileURLToPath } from 'url';

import { uploadToCos } from '@tencent/jarvis-webpack-cos';

const __dirname = fileURLToPath(new URL('.', import.meta.url));

const distDir = path.resolve(__dirname, '../dist');

uploadToCos(distDir).then(() => process.exit(0));
