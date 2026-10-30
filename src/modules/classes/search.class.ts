import { IncludeOptions } from 'sequelize';
import { ModelCtor } from 'sequelize-typescript';
import { getSearchWhereClause } from '../utils';

export class Search {
    include?: IncludeOptions;

    constructor(model: ModelCtor, searchTerms: string = '', alias: string = 'search') {
        if (searchTerms.length > 0) {
            const whereClause = getSearchWhereClause(searchTerms);
            this.include = {
                model,
                as: alias,
                where: whereClause
            };
        }
    }
}
