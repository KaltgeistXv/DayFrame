import { migrateDatabase } from './database.mjs';
import { resolve } from 'node:path';
const [source, destination] = process.argv.slice(2);
if (!source || !destination) throw Error('用法：node desktop/migrate.mjs 来源.sqlite 目标.sqlite');
process.umask(0o077);
await migrateDatabase(resolve(source), resolve(destination));
console.log('迁移完成：来源未改动；若目标已有数据库，本命令会拒绝覆盖。');
