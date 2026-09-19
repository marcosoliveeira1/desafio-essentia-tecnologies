import 'reflect-metadata'
import { DataSource } from 'typeorm'
import { env } from '../env.js'
import { ActivityLogEntity } from '../modules/activity/activity-log.entity.js'

export function createMongoDataSource(url?: string): DataSource {
	const mongoUrl = url ?? env.mongo.url
	const database = new URL(mongoUrl).pathname.replace(/^\//, '') || undefined
	return new DataSource({
		type: 'mongodb',
		url: mongoUrl,
		...(database !== undefined ? { database } : {}),
		entities: [ActivityLogEntity],
		synchronize: false,
		logging: false,
	})
}

export const mongoDataSource = createMongoDataSource()
