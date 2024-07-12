const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const cron = require('node-cron');
const app = express();
const port = 5000;
const { createPdConnection, createTsConnection, executeTsQuery, dbinit, tblinit } = require('./serverdb');
const { updateTables } = require('./updateTablesFunction'); // Import the updateTables function
const ejs = require('ejs');
// Set the view engine to EJS
app.set('view engine', 'ejs');
app.set('views', path.join(__dirname, '/views'));
// Middleware to serve static files from the 'public' directory
app.use(express.static(path.join(__dirname, '/public')));app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));


//Initialize variables
let pdConnection = null;
let tsConnection = null;

//---------------------- EUC Endpoints---------------------------------------------------//
//Cron job running every 12 hours to retrieve all latest projects active from timesite database.
const cronJob = cron.schedule('0 */12 * * *', async () => {
console.log('Running a job to update tables...');
updateTables(); // updateTables() - update of client and project tables in hero_eucdb database.
}, {
scheduled: true,
timezone: "Australia/Perth"
});

cronJob.start();

//Handle any errors that might occur
cronJob.on('error', (err) => {
console.error('Error with cron job:', err);
});

app.get('/getRevisionCodes', async (req, res) => {
try {
// Assuming pdConnection is properly initialized and connected to your database
const pdConnection = await createPdConnection();

// Execute SQL query to fetch revision codes
const query = `
SELECT revid, rev, revdesc
FROM code_revisions
ORDER BY revid;`;

const rows = await pdConnection.query(query); // Execute SQL query
const response = rows[0].map(item => {
  item.displayvalue = item.rev + "-" + item.revdesc
  return item;

});

// Close connection after query execution
await pdConnection.end();

// Send response with JSON data
res.status(200).json(response);

} catch (error) {
console.error('Error fetching revision codes:', error);
res.status(500).json({ message: 'Error fetching revision codes' });
}
});

app.get('/getDocuments', async (req, res) => {
  const projcode = req.query.projectcode;
  
  let pdConnection = null;
  try {
    pdConnection = await createPdConnection();
    if (projcode) {
      console.log(projcode);
      var projecode = projcode.toLocaleLowerCase();
      var query = `SELECT docno, docname, safety FROM tr_${projecode}.deliverables WHERE safety = 1`;
      const documents = await pdConnection.query(query);
      console.log(documents);
      // Create a new array with concatenated field
      let formattedDocuments = documents[0].map(doc => {
        return {
          docno: doc.docno,
          docname: doc.docname,
          displayField: `${doc.docno} - ${doc.docname}`
        };
      });

      res.status(200).json(formattedDocuments);
    } else {
      res.status(200).json([]);
    }
    
    


  }catch (error) {
    console.error('Error fetching revision codes:', error);
    res.status(500).json({ message: 'Error fetching revision codes' });
    }
 
});

app.get('/euc', async (req, res) => {
let pdConnection = null;
let values = [];
try {
pdConnection = await createPdConnection();

const tableNames = Object.keys(dbinit);
let hasInitializedTables = false; // Flag to track if table initialization has been performed

const defaultValues = Object.keys(tblinit);
for (const defaultValue of defaultValues) {
const queryValues = tblinit[defaultValue];
// Execute the query here or store it for execution later
}
// Example of executing queries based on tableNames
for (const tableName of tableNames) {
const queryTables = dbinit[tableName];
const tables = await pdConnection.query(queryTables);
// Process the result if needed
}

// Check if tables have been initialized
if (!hasInitializedTables) {
// Initialize tables if they haven't been initialized
const defaultValues = Object.keys(tblinit);
for (const defaultValue of defaultValues) {
const queryValues = tblinit[defaultValue];
await pdConnection.query(queryValues); // Execute the insert statements
// You may also handle the result if needed
}

// Set the flag to true to indicate initialization is complete
hasInitializedTables = true;
}

// Render euc.ejs after all queries are executed
res.render('euc');
} catch (error) {
console.error('Error Connecting to DB or executing queries:', error);
res.status(500).send({ message: 'Error Connecting to DB or executing queries' });
} finally {
// Close the database connection in finally block to ensure it's always closed
if (pdConnection) {
pdConnection.end();
}
}
});

app.post('/UpdateSW', async (req, res) => {
const { eucid, applicationdesc, applicationversion, applicationchecksum, softwarerequired, coderevision, revisiondate, baselinecreator, comments } = req.body;

try {
const pdConnection = await createPdConnection();

// Construct SQL query for updating the row in software_changes table
const updateQuery = `
UPDATE software_changes
SET applicationdesc = ?,
applicationversion = ?,
applicationchecksum = ?,
softwarerequired = ?,
coderevision = ?,
revisiondate = ?,
baselinecreator = ?,
comments = ?
WHERE eucid = ?
`;

const values = [applicationdesc, applicationversion, applicationchecksum, softwarerequired, coderevision, revisiondate, baselinecreator, comments, eucid];

// Execute the update query
await pdConnection.query(updateQuery, values);

// Close the connection
await pdConnection.end();

res.status(200).json({ message: 'Row updated successfully' });
} catch (error) {
console.error('Error updating row in software_changes:', error);
res.status(500).json({ message: 'Error updating row in software_changes' });
}
});

app.post('/updateSWRow', async (req, res) => {
const { eucid, projectid } = req.body;

try {
// Update projectid in software_changes table
const sql = `UPDATE software_changes SET projectid = ? WHERE eucid = ?`;
const params = [projectid, eucid];
pdConnection = await createPdConnection();
pdConnection.query(sql, params, (error, results) => {
if (error) {
console.error('Error updating projectid:', error);
res.status(500).json({ message: 'Error updating projectid' });
return;
}

console.log('Projectid updated successfully');
res.status(200).json({ message: 'Projectid updated successfully' });
});
} catch (error) {
console.error('Error updating projectid:', error);
res.status(500).json({ message: 'Error updating projectid' });
}
})

// Endpoint to handle GET request for EUC data
app.get('/getEUC', async (req, res) => {
try {
pdConnection = await createPdConnection();

// Execute SQL query to fetch EUC data
const query = await pdConnection.query('SELECT eucid, projectid, eucdesc, projectcode, clientname, projectname, datedecom FROM hero_eucdb.euc JOIN hero_projdb.project USING (projectid) JOIN hero_projdb.client USING (clientid) ORDER BY projectcode ASC, eucdesc ASC;');
const query_upd = query[0].map(item => {
item.datedecom = item.datedecom === '0000-00-00 00:00:00' ? null : item.datedecom;

});

// Send the fetched data as JSON response
res.status(200).json(query[0]); // Assuming query[0] contains the actual data rows

} catch (error) {
console.error('Error fetching EUC data:', error);
res.status(500).json({ message: 'Error fetching EUC data' });
}
});

app.get('/getProjCodes', async (req, res) => {
try {
// // Assuming pdConnection is properly initialized and connected to your database

// Execute SQL query to fetch project codes
// const projcode = await pdConnection.query(`
// SELECT projectid, CONCAT(projectcode, ' - ', clientname, ' - ', projectname) AS projectcode
// FROM hero_projdb.project
// JOIN hero_projdb.client USING (clientid)
// ORDER BY projectcode;
// `);
tsConnection = await createTsConnection();
pdConnection = await createPdConnection();
const tsQuery =
"SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
"FROM (dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid) " +
"WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode";

const tsResult = await executeTsQuery(tsQuery);
const allProjects = {};

tsResult.forEach((tsRow) => {
const projCode = `tr_${tsRow.projectcode.toLowerCase()}`;
allProjects[projCode] = `${tsRow.projectcode} - ${tsRow.clientname} - ${tsRow.projectname}`;
});

const pdResult = await pdConnection.query('SHOW DATABASES');
const pdRows = pdResult[0];

const databases = [];
const projectsWithoutDB = [];

pdRows.forEach((pdRow) => {
if (pdRow.Database.includes('tr')) {
databases.push(pdRow.Database.toUpperCase().substring(3, pdRow.Database.length));
}
});

const matchedObjects = [];

databases.forEach(item => {
const matchedObject = tsResult.find(obj => obj.projectcode === item);
if (matchedObject) {
matchedObjects.push({
projectid: matchedObject.projectid,
projectcode: matchedObject.projectcode,
projectdesc: `${matchedObject.projectcode} - ${matchedObject.clientname} - ${matchedObject.projectname}`,
projectname: matchedObject.projectname,
clientname: matchedObject.clientname,
clientid: matchedObject.clientid,
clientcode: matchedObject.projectcode.substring(0, 5)

});
}
});

// Send matchedObjects as JSON response
res.status(200).json(matchedObjects);

} catch (error) {
console.error('Error fetching project codes:', error); // Log the error for debugging
res.status(500).json({ message: 'Error fetching project codes' }); // Send 500 error response
}
});

app.post('/saveSW', async (req, res) => {
try {
const { projectid, eucid, applicationdesc, applicationversion, applicationchecksum, softwarerequired, coderevision,codesubrevision, revisiondate, baselinecreator, comments } = req.body;

// Assuming pdConnection is your MySQL connection pool
const sql = `
INSERT INTO software_changes
(projectid, eucid, applicationdesc, applicationversion, applicationchecksum, softwarerequired, coderevision,codesubrevision, revisiondate, baselinecreator, comments)
VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`;

const values = [projectid, eucid, applicationdesc, applicationversion, applicationchecksum, softwarerequired, coderevision,codesubrevision, revisiondate, baselinecreator, comments];

const result = await pdConnection.query(sql, values);

console.log('Inserted rows:', result.affectedRows); // Log number of inserted rows

res.json({ message: 'Software change data submitted successfully' });
} catch (error) {
console.error('Error saving software change:', error);
res.status(500).json({ error: 'Error saving software change' });
}
});

// Endpoint to fetch software change data by eucid and projectid
app.get('/getSW', async (req, res) => {
try {
const { eucid, projectid } = req.query;

if (eucid && projectid) {
const sql = `
SELECT *
FROM software_changes
WHERE eucid = ?
`;

const values = [eucid, projectid];
const result = await pdConnection.query(sql, values);

res.status(200).json(result[0]);
} else{
res.status(200).json([]);
}

} catch (error) {
console.error('Error fetching software changes:', error);
res.status(500).json({ error: 'Error fetching software changes' });
}
})

// Endpoint to handle POST request to save EUC data
app.post('/saveEUC', async (req, res) => {
const { projectcode, eucdescription, datedecom } = req.body;
// req.body will contain all the form fields and their values
// For example:

const sql = 'INSERT INTO hero_eucdb.euc (projectid, eucdesc, datedecom) VALUES (?, ?, ?)';
const values = [projectcode, eucdescription, datedecom];
await pdConnection.query(sql, values)
res.json({ message: 'EUC data submitted successfully' });
});

// Endpoint to handle GET request for owners data
app.get('/getOwners', async (req, res) => {
const eucid = req.query.eucid;
try {
pdConnection = await createPdConnection();
const sql = 'SELECT `ownerid`, `ownerdesc`, `eucid`, `dateowned` FROM `owner` WHERE `eucid` = ? ORDER BY `dateowned` DESC';
const result = await pdConnection.query(sql, [eucid]);

const owners = result[0].map(row => ({
ownerid: row.ownerid,
ownerdesc: row.ownerdesc,
eucid: row.eucid,
dateowned: row.dateowned
}));

res.status(200).json(owners);

} catch (error) {
console.error('Error fetching owners:', error); // Log the error for debugging
res.status(500).json({ message: 'Error fetching Owners' }); // Send 500 error response
}
});

// Endpoint to handle POST request to save owners data
app.post('/saveOwner', async (req, res) => {
try {
// Logic to save owners data received in the request body
const { eucid, ownerdesc, dateowned } = req.body;
// req.body will contain all the form fields and their values
// For example:
console.log('Form fields and values:', { eucid, dateowned, ownerdesc });
const sql = 'INSERT INTO owner (ownerdesc, eucid, dateowned) VALUES (?, ?, ?)';
const values = [ownerdesc, eucid, dateowned];
await pdConnection.query(sql, values)
res.status(200).json({ message: 'Owner data submitted successfully' });

} catch (error) {
console.error('Error fetching owners:', error); // Log the error for debugging
res.status(500).json({ message: 'Error fetching owners' }); // Send 500 error response
}
});

// Endpoint to handle GET request for documents data
app.get('/getDoc', async (req, res) => {
try {
const projectcode = req.query.projectcode;
const eucid = req.query.eucid
if (projectcode && eucid) {
;
console.log({ projectcode, eucid });
var projcode = projectcode.toLowerCase();
const sql = `
SELECT docid, docno, Doc.docname , eucid, '${projcode}' as projectcode
FROM hero_eucdb.document
JOIN hero_eucdb.euc USING (eucid)
JOIN (
SELECT docno, docname,safety FROM tr_${projcode}.deliverables
UNION
SELECT docno, docname , NULL AS safety FROM tr_${projcode}.transmittals
) as Doc USING (docno)
WHERE eucid = ${eucid};
`;

const result = await pdConnection.query(sql);
console.log(result);
const docs = result[0].map(row => ({
docid: row.docid,
docno: row.docno,
docname: row.docname,
eucid: row.eucid,
projectcode: row.projectcode
}));
res.status(200).json(docs);
} else {
res.status(200).json([]);
}

} catch (error) {
console.error('Error fetching documents:', error); // Log the error for debugging
res.status(500).json({ message: 'Error fetching documents' }); // Send 500 error response
}
});

app.post('/saveDoc', async (req, res) => {
try {
const { eucid, docnumber } = req.body;
console.log(docnumber);
// Check if the (docno, eucid) combination already exists in the document table
const checkDuplicateQuery = 'SELECT COUNT(*) AS count FROM document WHERE docno = ? AND eucid = ?';
const checkDuplicateValues = [docnumber, eucid];
const [rows] = await pdConnection.query(checkDuplicateQuery, checkDuplicateValues);
const { count } = rows[0];

if (count > 0) {
// If a record already exists with the same (docno, eucid), return a 409 Conflict status
return res.status(409).json({ message: 'Duplicate entry: This document already exists for the specified EUC.', count: count });
}

// If no duplicate, proceed to insert the new document record
const insertQuery = 'INSERT INTO document (docno, eucid) VALUES (?, ?)';
const insertValues = [docnumber, eucid];
await pdConnection.query(insertQuery, insertValues);

res.status(200).json({ message: 'Document data submitted successfully' });

} catch (error) {
console.error('Error submitting document:', error);
res.status(500).json({ message: 'Error submitting document' });
}
});
app.post('/updateOwner', async (req, res) => {
try {
const { eucid, ownerdesc, ownerid, dateowned } = req.body;
if (!dateowned) {
formattedDate = "0000-00-00 00:00:00";

} else {
var formattedDate = dateowned;
}
const query = `
UPDATE hero_eucdb.owner
SET ownerdesc = ?,
dateowned = ?

WHERE ownerid = ?`;
// Execute the query with parameters
await pdConnection.query(query, [ownerdesc, dateowned, ownerid]);
res.status(200).json("Successfully Updated the Owners Table");
} catch (error) {
console.error('Error updating Owners:', error);
res.status(500).json({ error: 'Internal server error' });
}

});

// Route handler
app.get('/getMRQ', async (req, res) => {
const projectId = req.query.projectid;

let tsConnection;
let pdConnection;

try {
if (projectId) {
// Create MSSQL Server connection
await createTsConnection();

// Query to fetch MRQ data from MSSQL Server
const tsQuery = `
SELECT [helpdeskid], [logbyname], [logdate], [projectid]
FROM [Timesite].[dbo].[vwhelpdesk]
WHERE [subcategorydesc] LIKE 'EUC%' AND [projectid] ='${projectId}'
ORDER BY [logdate] DESC
`;

const tsResult = await executeTsQuery(tsQuery); // Execute MSSQL Server query

// Create MySQL connection
pdConnection = await createPdConnection();

// Array to hold promises for MySQL queries
const mysqlQueries = tsResult.map(async (row) => {
// Query to fetch checksum from MySQL
const mysqlQuery = `
SELECT checksum
FROM hero_eucdb.checksums
WHERE projectid = ${projectId} AND helpdeskid = ${row.helpdeskid}
`;

const [mysqlRows] = await pdConnection.query(mysqlQuery); // Execute MySQL query

// Format result object
const resultObj = {
helpdeskid: `<a href='http://timesite.heroengineering.com.au/TimeSite/HelpDesk/Detail.aspx?hdid=${row.helpdeskid}' target='_blank'>${row.helpdeskid}</a>`,
logbyname: row.logbyname,
projectid: row.projectid,
logdate: new Date(row.logdate).toLocaleDateString('en-AU'), // Format date as 'dd-mm-yyyy'
checksum: mysqlRows ? mysqlRows.checksum : null
};

return resultObj;
});

// Execute all MySQL queries concurrently
const results = await Promise.all(mysqlQueries);

// Send results as JSON response
res.status(200).json(results);
} else {
res.status(200).json([]);
}
} catch (error) {
console.error('Error fetching MRQ data:', error);
res.status(500).json({ error: 'Error fetching MRQ data' });
} finally {
// Close connections in finally block to ensure cleanup
if (tsConnection) {
await sql.close();
}
if (pdConnection) {
await pdConnection.end();
}
}
});

// Endpoint to handle POST request to update MRQ data
app.post('/updateMRQ', async (req, res) => {
// Logic to update MRQ data received in the request body
});

// Endpoint to handle POST request to update MRQ data
app.post('/UpdateEUC', async (req, res) => {
try {
const { eucid, eucdesc, projectcode, clientname, projectname, datedecom, projectid } = req.body;

if (!datedecom) {
formattedDate = "0000-00-00 00:00:00";

} else {
var formattedDate = datedecom;
}

const query = `
UPDATE hero_eucdb.euc
SET eucdesc = ?,
projectid = ?,
datedecom = ?
WHERE eucid = ?`;

// Execute the query with parameters
await pdConnection.query(query, [eucdesc, projectid, formattedDate, eucid]);
res.status(200).json("Successfully Updated the EUC");
} catch (error) {
console.error('Error updating EUC:', error);
res.status(500).json({ error: 'Internal server error' });
}

});

// Endpoint to handle GET request for checksums data
app.get('/getChk', async (req, res) => {
// Logic to fetch checksums data from the server or database
});

// Endpoint to handle POST request to save checksums data
app.post('/saveChk', async (req, res) => {
// Logic to save checksums data received in the request body
});

process.on('SIGINT', () => {
if (pdConnection) {
pdConnection.end();
}
if (tsConnection) {
tsConnection.close();
}
process.exit(0);
});

app.listen(port, function () {
console.log('Example app listening on port 5000!');
});