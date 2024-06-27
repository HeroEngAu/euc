const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 5000;
const { createPdConnection, createTsConnection, executeTsQuery } = require('./serverdb');
const { Console, count } = require('console');
const ejs = require('ejs');

app.engine('ejs', ejs.renderFile);
app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

//Initialize variables 
let pdConnection = null;
let tsConnection = null;



//----------------------   EUC Endpoints---------------------------------------------------//
app.get('/euc', async (req, res) => {
  res.render('euc'); // Render euc.ejs for the '/euc' page
  try {
    pdConnection = await createPdConnection();
    tsConnection = await createTsConnection();

  } catch {
    res.status(500).send({ message: 'Error Connecting to DB' });

  }
});

// Endpoint to handle GET request for EUC data
app.get('/getEUC', async (req, res) => {
  try {
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
    //         SELECT projectid, CONCAT(projectcode, ' - ', clientname, ' - ', projectname) AS projectcode 
    //         FROM hero_projdb.project 
    //         JOIN hero_projdb.client USING (clientid) 
    //         ORDER BY projectcode;
    //     `);
    
    const tsQuery =
      "SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
      "FROM (dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid) " +
      "WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode";

    const tsResult = await executeTsQuery(tsConnection, tsQuery);
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
          clientname: matchedObject.clientname
        });
      }
    });
    console.log(matchedObjects);
    // Send matchedObjects as JSON response
    res.status(200).json(matchedObjects);

  

  } catch (error) {
    console.error('Error fetching project codes:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error fetching project codes' }); // Send 500 error response
  }
});


// Endpoint to handle POST request to save EUC data
app.post('/saveEUC', async (req, res) => {
  console.log(req.body);
  // req.body will contain all the form fields and their values
  // For example:
  console.log('Form fields and values:');
  for (const [key, value] of Object.entries(req.body)) {
    console.log(`${key}: ${value}`);
  }
  res.json({ message: 'EUC data received successfully' });
});

// Endpoint to handle GET request for owners data
app.get('/getOwners', async (req, res) => {
  const eucid = req.query.eucid;
  try {
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
    console.error('Error fetching project codes:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error fetching project codes' }); // Send 500 error response
  }
});

// Endpoint to handle POST request to save owners data
app.post('/saveOwners.php', async (req, res) => {
  // Logic to save owners data received in the request body
});

// Endpoint to handle GET request for documents data
app.get('/getDoc', async (req, res) => {
  const projcode = req.query.projectcode.toLowerCase();
  const eucid = req.query.eucid;
  try {
    const sql = `
  SELECT docid, docno, Doc.docname, eucid, '${projcode}' as projectcode
  FROM hero_eucdb.document
  JOIN hero_eucdb.euc USING (eucid)
  JOIN (
    SELECT docno, docname FROM tr_${projcode}.deliverables
    UNION
    SELECT docno, docname FROM tr_${projcode}.transmittals
  ) as Doc USING (docno)
  WHERE eucid = ${eucid};
`;

    const result = await pdConnection.query(sql);
    const docs = result[0].map(row => ({
      docid: row.docid,
      docno: row.docno,
      docname: row.docname,
      eucid: row.eucid,
      projectcode: row.projectcode
    }));
    res.status(200).json(docs);
    

  } catch (error) {
    console.error('Error fetching project codes:', error); // Log the error for debugging
    res.status(500).json({ message: 'Error fetching project codes' }); // Send 500 error response
  }
});

// Endpoint to handle POST request to save documents data
app.post('/saveDoc.php', async (req, res) => {
  // Logic to save documents data received in the request body
});



app.get('/getMRQ', async (req, res) => {
  const projectId = req.query.projectid;

  let tsConnection;
  let pdConnection;

  try {
    // Create SQL Server connection
    tsConnection = await createTsConnection();

    // Query to fetch MRQ data from SQL Server
    const tsQuery = `
      SELECT [helpdeskid], [logbyname], [logdate], [projectid]
      FROM [Timesite].[dbo].[vwhelpdesk]
      WHERE [subcategorydesc] LIKE 'EUC%' AND [projectid] ='${projectId}'
      ORDER BY [logdate] DESC
    `;

    const tsResult = await executeTsQuery(tsConnection, tsQuery); // Execute SQL Server query

    // Close SQL Server connection after query execution
    tsConnection.close();

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
        checksum: mysqlRows.length > 0 ? mysqlRows[0].checksum : null
      };

      return resultObj;
    });

    // Execute all MySQL queries concurrently
    const results = await Promise.all(mysqlQueries);

    // Send results as JSON response
    res.json(results);
  } catch (error) {
    console.error('Error fetching MRQ data:', error);
    res.status(500).json({ error: 'Error fetching MRQ data' });
  } finally {
    // Close connections in finally block to ensure cleanup
    if (tsConnection) {
      tsConnection.close();
    }
    if (pdConnection) {
      pdConnection.end();
    }
  }
});


// Endpoint to handle POST request to update MRQ data
app.post('/updateMRQ.php', async (req, res) => {
  // Logic to update MRQ data received in the request body
});

// Endpoint to handle GET request for checksums data
app.get('/getChk.php', async (req, res) => {
  // Logic to fetch checksums data from the server or database
});

// Endpoint to handle POST request to save checksums data
app.post('/saveChk.php', async (req, res) => {
  // Logic to save checksums data received in the request body
});

app.listen(port, function () {
  console.log('Example app listening on port 5000!');
});
