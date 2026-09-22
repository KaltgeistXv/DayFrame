import {env} from 'cloudflare:workers';
export function database(){if(!env.DB)throw Error('数据库暂时无法连接');return env.DB}
