//SQLTablesManager.js// 

// import database module
const { Database } = require("../database/Database.js");

class SQLTablesManager{
    constructor(config, modules) {
        this.config = config;
        this.modules = modules;
        this.db = new Database(config).connection();
    }

    loadTables() {
        let modules = [];

        this.modules.forEach((e) => {
            modules.push(
                new e(null, null, null).loadTables()
            )
        })

        this.db.getConnection((err, conn) => {
            if(err) throw err;

            for(const m of modules) {
                m.forEach((e) => {
                    conn.query(e, (err) => {
                        if(err) throw err;
                    })
                });
            }

            this.db.releaseConnection(conn);
        });
    }
}

module.exports = {
    SQLTablesManager
}