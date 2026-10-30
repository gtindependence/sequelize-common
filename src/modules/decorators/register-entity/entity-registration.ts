import { ModelCtor } from 'sequelize-typescript';

const defaultDatabaseName = 'DEFAULT_DATABASE_NAME';

export class EntityRegistration {
    private static databaseModels: { [databaseName: string]: ModelCtor[] } = {
        [defaultDatabaseName]: []
    };

    static registerEntity(model: ModelCtor, databaseName?: string) {
        const database = databaseName || defaultDatabaseName;

        if (EntityRegistration.databaseModels[database]) {
            EntityRegistration.databaseModels[database].push(model);
        }
        else {
            EntityRegistration.databaseModels[database] = [model];
        }
    }

    static getEntities(databaseName?: string) {
        return EntityRegistration.databaseModels[databaseName || defaultDatabaseName];
    }
}
