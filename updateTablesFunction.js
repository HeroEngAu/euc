const { createPdConnection, createTsConnection, executeTsQuery } = require('./serverdb');
const mysql = require('mysql2');

async function updateTables() {
  let pdConnection = null;
  let tsConnection = null;
  try {
    // Establish connections
    pdConnection = await createPdConnection();
    tsConnection = await createTsConnection();

    const tsQuery =
      "SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
      "FROM dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid " +
      "WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode";

    // Execute query on SQL Server
    const tsResult = await executeTsQuery(tsQuery);
    tsResult.forEach(row => {
      row.clientcode = row.projectcode.substring(0, 5).toUpperCase(); // Example: Take first 3 characters and convert to uppercase
    });


    const pdResult = await pdConnection.query('SHOW DATABASES');
    const pdRows = pdResult[0];
   
    const databases = pdRows
      .filter(pdRow => pdRow.Database.includes('tr'))
      .map(pdRow => pdRow.Database.toUpperCase().substring(3));



    const clientInsertQuery = `
      INSERT IGNORE INTO hero_projdb.client (clientid, clientcode, clientname, contactperson)
      SELECT ?, ?, ?, NULL  
      WHERE NOT EXISTS (
        SELECT 1 FROM hero_projdb.client WHERE clientid = ?
      )
    `;

    const projectInsertQuery = `
      INSERT IGNORE INTO hero_projdb.project (projectid, clientid, projectcode, projectname)
      SELECT ?, ?, ?, ?
      WHERE NOT EXISTS (
        SELECT 1 FROM hero_projdb.project WHERE projectid = ?
      )
    `;

    for (const item of databases) {
      const matchedObject = tsResult.find(obj => obj.projectcode === item);

      if (matchedObject) {
        await pdConnection.query(clientInsertQuery, [matchedObject.clientid, matchedObject.clientcode, matchedObject.clientname, matchedObject.clientid]);
        console.log('Inserted into client table');

        await pdConnection.query(projectInsertQuery, [matchedObject.projectid, matchedObject.clientid, matchedObject.projectcode, matchedObject.projectname, matchedObject.projectid]);
        console.log('Inserted into project table');
      } else {
        console.log(`No match found for database ${item}`);
      }
    }

  } catch (error) {
    console.error('Error inserting values in EUC project and client tables:', error);
    // Throw error to be caught by a higher-level error handler if using Express.js
    throw error; // This will propagate the error upwards
  } finally {
    // Close connections in finally block to ensure they are always closed
    if (pdConnection) pdConnection.end();
    if (tsConnection) tsConnection.release(); // Release the SQL Server connection back to the pool
  }
}

module.exports = {
  updateTables
};