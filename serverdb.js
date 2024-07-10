const mysql = require('mysql2/promise');
const { Connection, Request } = require('tedious');
const sql = require('mssql');
const { ConnectionPool } = require('tedious-connection-pool');

// MySQL Database parameters
const pdServer = "192.168.0.143";
const pdUser = "dbserver";
const pdPass = "hero123@";

const pdConfig = (databaseName) => ({
  host: pdServer,
  port: 3306,
  user: pdUser,
  password: pdPass,
  database: 'hero_eucdb',
  connectTimeout: 60000,
  dateStrings: true
});

const createPdConnection = (database) => mysql.createConnection(pdConfig(database));

// MSSQL Database parameters
const config = {
  user: 'sa',
  password: 'T1mesit3',
  server: '192.168.0.5',
  database: 'TIMESITE',
  pool: {
    max: 10,
    min: 0,
    idleTimeoutMillis: 30000
  },
  options: {
    encrypt: false, // You might want to set this to true if your server requires encryption
    enableArithAbort: true // This option is important to avoid SQL Server error related to arithabort setting
  }
};


let pool;

const createTsConnection = async () => {
  try {
    if (!pool) {
      pool = await sql.connect(config);
      console.log('Connected to MSSQL Server');
    }
    return pool;
  } catch (err) {
    console.error('Database connection error:', err);
    throw err;
  }
};

const executeTsQuery = async (query) => {
  try {
    const result = await sql.query(query);
    return result.recordset;
  } catch (err) {
    console.error('Error executing query:', err);
    throw err;
  }
};

const dbinit = {
  "software_changes": `
    CREATE TABLE IF NOT EXISTS software_changes (
      projectid INT NOT NULL,
      eucid INT NOT NULL,
      applicationdesc VARCHAR(255),
      applicationversion DATETIME,
      applicationchecksum VARCHAR(255),
      softwarerequired VARCHAR(255),
      coderevision VARCHAR(10),
      revisiondate DATETIME,
      baselinecreator VARCHAR(255),
      comments VARCHAR(255),
      PRIMARY KEY (eucid)
    ) ENGINE=InnoDB DEFAULT CHARSET=latin1;
  `,
  "code_revisions": `
    CREATE TABLE IF NOT EXISTS code_revisions (
          revid INT(11) NOT NULL AUTO_INCREMENT,
          rev VARCHAR(45) NOT NULL,
          revdesc VARCHAR(45) NOT NULL,
          PRIMARY KEY (revid),
          UNIQUE KEY rev_UNIQUE (rev)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `}

  const tblinit = {
    "code_revisions": `
      INSERT IGNORE INTO code_revisions (revid, rev, revdesc) VALUES  
      (1, 'A', 'Preliminary Design'),
      (2, 'B', 'Internal Review'),
      (3, 'C', 'Client Review'),
      (4, 'D', 'Client Review'),
      (5, '0', 'Issued For Construction'),
      (6, '1', 'Asbuilt')
    `
  };

module.exports = {
  createPdConnection,
  createTsConnection,
  executeTsQuery,
  dbinit,
  tblinit
};
