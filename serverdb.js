const mysql = require('mysql2/promise');
const { Connection, Request, TYPES } = require('tedious');


// Project Database DB parameters
const pdServer = "192.168.0.169";
const pdUser = "dbserver";
const pdPass = "hero123@";


const pdConfig = () => ({
  host: pdServer,
  port: 3306,
  user: pdUser,
  password: pdPass,
  database: 'hero_eucdb',
  connectTimeout: 60000,
  dateStrings: true
});


const createPdConnection = (database) => mysql.createConnection(pdConfig(database));

const config = {
    server: '192.168.0.5',
    authentication: {
      type: 'default',
      options: {
        userName: 'sa',
        password: 'T1mesit3'
      }
    },
    options: {
      encrypt: false,
      database: 'TIMESITE'
    }
  };

  const createTsConnection = () => {
    const connection = new Connection(config);
    return new Promise((resolve, reject) => {
      connection.on('connect', function(err) {
        if (err) {
          reject(err);
        } else {
          resolve(connection);
        }
      });
  
      connection.connect();
    });
  };
  const executeTsQuery = (connection, query) => {
    return new Promise((resolve, reject) => {
      const request = new Request(query, function(err) {
        if (err) {
          reject(err);
        }
      });
  
      const results = [];
  
      request.on('row', function(columns) {
        let row = {};
        columns.forEach(function(column) {
          row[column.metadata.colName] = column.value;
        });
        results.push(row);
      });
  
      request.on('requestCompleted', function() {
        resolve(results);
      });
      connection.execSql(request);
  });
};
  module.exports = {
    createPdConnection,
    createTsConnection,
    executeTsQuery
    
  };
