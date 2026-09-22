import { openDatabase } from './database.mjs';
import { join } from 'node:path';
if (!process.env.DAYFRAME_DATA_DIR || !process.env.DAYFRAME_RESOURCES) throw Error('客户端目录未配置');
const db = openDatabase(join(process.env.DAYFRAME_DATA_DIR, 'workspace.sqlite'), join(process.env.DAYFRAME_RESOURCES, 'migrations'));
export function database() { return db; }
