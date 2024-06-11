const mysql = require('mysql2/promise');

const pdServer = "192.168.0.169";
const pdUser = "dbserver";
const pdPass = "hero123@";

const pdConfig = (databaseName) => ({
    host: pdServer,
    port: 3306,
    user: pdUser,
    password: pdPass,
    connectTimeout: 60000,
    dateStrings: true
});

const createPdConnection = async (database) => {
    try {
        const connection = await mysql.createConnection(pdConfig());
        console.log("MySQL Connection success");
        
        // Now that connection is established, let's test it by querying databases
        const [rows, fields] = await connection.query('SHOW DATABASES');
        console.log("Databases:");
        rows.forEach(row => {
            console.log(row.Database);
        });
        
        // Don't forget to close the connection after use
        await connection.end();
        
        return connection;
    } catch (error) {
        console.error(`Error connecting to MySQL database: ${error.message}`);
        throw error;
    }
};

// Test the function
createPdConnection('mysql_database_name')
    .then(() => {
        console.log("Connection test successful.");
    })
    .catch((error) => {
        console.error("Connection test failed:", error.message);
    });

module.exports = { createPdConnection };
