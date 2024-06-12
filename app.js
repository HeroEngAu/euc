const express = require('express');
const bodyParser = require('body-parser');
const path = require('path');
const app = express();
const port = 3000;
const { createPdConnection, createTsConnection, executeTsQuery, dbinit, tblinit } = require('./db');
const { Console, count } = require('console');
const { PDFDocument, rgb, pdfDocEncodingDecode, StandardFonts } = require('pdf-lib');
const fs = require('fs').promises;
const fontkit = require("@pdf-lib/fontkit");

app.use(express.static('public'));
app.use(express.json());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));
app.set('view engine', 'ejs');

//Initialize variables 
let pdConnection = null;
let allProjects = {}; // Initialize allProjects
let allProjectCodes = {};
let projects = {};
let deliverables = []; // Initialize all deliverables
let blocklimit = 100;
let doc_num = 0;



app.post('/return-transmittal-save', async (req, res) => {
  const docno = req.body.trno;
  var del = req.body.del;

  const retdate = req.body.trRetDate;

  try {
    const resQuery = await pdConnection.query(`UPDATE transmittals SET returndate='${retdate}' WHERE docno= '${docno}'`);
    if (del.length === 0) {
      del = [];

    }
    for (const item of del) {
      const [doc, reid] = item.split("|");
      await pdConnection.query('UPDATE revisions SET returndate= ? WHERE id= ?', [retdate, reid]);
      await pdConnection.query('UPDATE revNew SET returndate= ? WHERE id= ?', [retdate, reid]);
    }
    const pdresult_tr = await pdConnection.query("(SELECT t.docno AS trno, t.docname AS trname, IF(complete = 1 OR t.returndate != '0000-00-00' AND cancelled = 0, 1, 0) as complete, t.cancelled, IF(t.expretdate <= curdate() AND t.returndate = '0000-00-00' AND complete = 0 AND cancelled = 0, 1, 0) AS overdue, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, GROUP_CONCAT(td.docno SEPARATOR '<br>') AS docno, GROUP_CONCAT(d.docname SEPARATOR '<br>') as docname, GROUP_CONCAT(CONCAT(r.revid,IFNULL(r.subrev,'')) SEPARATOR '<br>') AS rev FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id GROUP BY t.docno ORDER BY overdue DESC, complete ASC, cancelled ASC, issuedate DESC)");

    const modifiedResultTrans = pdresult_tr[0].map(transmittal => {
      const formattedItems = [];
      transmittal.returndate = formatDate(transmittal.returndate);
      if (transmittal.docno !== null && transmittal.docno !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.docno.includes('<br>')) {
          // If docno field contains multiple items, split it into an array
          transmittal.docno = transmittal.docno.split('<br>');
        } else {
          // If docno field contains only one item, create an array with a single item
          transmittal.docno = [transmittal.docno];
        }
        // Flatten the array to handle both cases
        transmittal.docno = transmittal.docno.flat();
        transmittal.total = transmittal.docno.length;
      } else {
        transmittal.docno = [''];
        transmittal.total = 0;
      }
      // Handling 'rev' field
      if (transmittal.rev !== null && transmittal.rev !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.rev.includes('<br>')) {
          transmittal.rev = transmittal.rev.split('<br>');
          for (let i = 0; i < transmittal.rev.length; i++) {
            transmittal.rev[i] = rev(parseInt(transmittal.rev[i].substring(0, 1)))[0];
          }
        } else {
          transmittal.rev = [rev(parseInt(transmittal.rev.substring(0, 1)))];
        }
        transmittal.rev = transmittal.rev.flat();
      } else {
        transmittal.rev = [''];
      }

      // Handling 'docname' field
      if (transmittal.docname !== null && transmittal.docname !== '') {
        if (typeof transmittal.docname === 'string' && transmittal.docname.includes('<br>')) {
          transmittal.docname = transmittal.docname.split('<br>');
        } else {
          transmittal.docname = [transmittal.docname];
        }
        transmittal.docname = transmittal.docname.flat();
      } else {
        transmittal.docname = [''];
      }

      // Assuming transmittal is an object with arrays docno, rev, and docname

      // Initialize an empty array to store formatted items


      // Iterate over the arrays in transmittal
      for (let i = 0; i < transmittal.docno.length; i++) {
        // Check if any of the properties are empty for the current index
        if (transmittal.docno[i] && transmittal.rev[i] && transmittal.docname[i]) {
          // If all properties are not empty, format the string and push it to formattedItems
          const formattedString = `${transmittal.docno[i]} - r.${transmittal.rev[i]} - ${transmittal.docname[i]}`;
          formattedItems.push(formattedString);
        }
      }

      // Assign the formattedItems array to transmitted_documents property of transmittal
      transmittal.transmitted_documents = formattedItems;


      return transmittal;
    });

    res.status(200).json({ transmittals: modifiedResultTrans })
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }

});

app.post('/return-transmittal-details', async (req, res) => {
  const docno = req.body.docno;
  try {
    const pdquery_trIssued = `SELECT t.docno AS trno, t.docname AS trname, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, td.docno AS docno, d.docname AS docname, CONCAT(r.revid,IFNULL(r.subrev,'')) AS rev, td.revid AS revid FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id WHERE t.docno = '${docno}' AND r.returndate = '0000-00-00'`;
    const pdresult_trIssued = await pdConnection.query(pdquery_trIssued);
    console.log(pdresult_trIssued);



    const trIssued_Addel = pdresult_trIssued[0].map(trIssued => {
      if (trIssued.rev !== '' && trIssued.rev !== null) {
        // Split the rev string into first character and rest of characters
        const firstChar = trIssued.rev.charAt(0);
        const restOfChars = trIssued.rev.substring(1);

        // Convert the first character to a number using rev function
        const firstCharNumber = rev(parseInt(firstChar));

        // Concatenate the first character number and the rest of characters (if any)
        trIssued.rev = restOfChars.length > 0 ? firstCharNumber[0] + restOfChars : firstCharNumber[0];
      } else {
        trIssued.rev = '';
      }

      // Construct the description using docno, rev, and docname
      trIssued.desc = (trIssued.docno !== null && trIssued.rev !== null && trIssued.docname !== null) ?
        trIssued.docno + "-" + "r." + trIssued.rev + "-" + trIssued.docname : '';

      return trIssued;
    });

    res.status(200).json({ addel: trIssued_Addel });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');

  }
});

// ENPOINT: get for edit transmittal connection

app.post('/transmittal-details', async (req, res) => {
  const docno = req.body.docno;
  const transdel = {};

  try {
    // First query to fetch transmittal details
    const pdqueryTranDetails = await pdConnection.query(`SELECT t.docno AS trno, t.docname AS trname, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, td.docno AS docno, d.docname AS docname, CONCAT(r.revid, IFNULL(r.subrev,'')) AS rev, td.revid AS revid FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id WHERE t.docno = '${docno}'`);

    // Populate transdel object with docno as key and an array containing rev, revid, and docname as value
    for (const pdrow of pdqueryTranDetails[0]) {
      transdel[pdrow['docno']] = [pdrow['rev'], pdrow['revid'], pdrow['docname']];
    }

    // Second query to fetch deliverables
    const pdqueryDeliverables = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.issuedate FROM (SELECT DISTINCT docno, max(id) AS id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno) WHERE issuedate = '0000-00-00'";
    const pdresultDeliverables = await pdConnection.query(pdqueryDeliverables);
    console.log(pdresultDeliverables);
    // Filter deliverables based on transdel
    const trIssued_Addel = pdresultDeliverables[0].filter(del => !(del['docno'] in transdel)).map(trIssued => {
      trIssued.rev = rev(parseInt(trIssued.rev));
      trIssued.rev = trIssued.subrev !== null && trIssued.subrev !== ' ' ? trIssued.rev[0] + "." + trIssued.subrev : trIssued.rev[0];
      trIssued.desc = (trIssued.docno !== null && trIssued.rev !== null && trIssued.docname !== null) ? trIssued.docno + "-" + "r." + trIssued.rev + "-" + trIssued.docname : '';
      return trIssued;
    });
    console.log(pdqueryTranDetails[0]);
    // Map the existing deliverables
    const trIssued_Remdel = pdqueryTranDetails[0].map(trIssued => {
      if (trIssued.rev !== '' && trIssued.rev !== null) {
        // Split the rev string into first character and rest of characters
        const firstChar = trIssued.rev.charAt(0);
        const restOfChars = trIssued.rev.substring(1);

        // Convert the first character to a number using rev function
        const firstCharNumber = rev(parseInt(firstChar));
        console.log(firstCharNumber);
        // Concatenate the first character number and the rest of characters (if any)
        trIssued.rev = restOfChars.length > 0 ? firstCharNumber[0] + restOfChars : firstCharNumber[0];
      } else {
        trIssued.rev = '';
      }

      // Construct the description using docno, rev, and docname
      trIssued.desc = (trIssued.docno !== null && trIssued.rev !== null && trIssued.docname !== null) ?
        trIssued.docno + "-" + "r." + trIssued.rev + "-" + trIssued.docname : '';

      return trIssued;
    });


    res.status(200).json({ addel: trIssued_Addel, remDel: trIssued_Remdel });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/return-deliverables', async (req, res) => {
  const formattedDate = req.body.formattedDate;
  const id = req.body.revid;
  try {
    const queryRev = `UPDATE revisions SET returndate='${formattedDate}' WHERE id=${id}`;
    const pdqueryRev = await pdConnection.query(queryRev);
    const queryRevNew = `UPDATE revNew SET returndate='${formattedDate}' WHERE id=${id}`;
    const pdqueryRevNew = await pdConnection.query(queryRevNew);
    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc as revdes, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00' AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING(docno, id) GROUP BY rev.docno) AS r USING(docno) ORDER BY overdue DESC, complete ASC";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);
    const ModifiedupdatedDeliverables = updatedDeliverables.map((deliverable) => {
      deliverable.rev = rev(parseInt(String(deliverable.rev).substring(0, 1)));
      return deliverable;
    });
    res.status(200).json({ deliverables: ModifiedupdatedDeliverables });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }

});


app.post('/pending-revisions', async (req, res) => {
  const { projdb } = req.body.projdb;

  try {
    const pdquery = "SELECT d.docno,CONCAT(r.revid,IFNULL(r.subrev,'')) AS rev,r.id as revid,d.docname as docname FROM (revisions AS r LEFT JOIN deliverables AS d USING (docno)) WHERE issuedate != '0000-00-00' AND returndate = '0000-00-00'";
    var pdqueryresult = await pdConnection.query(pdquery);
    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc as revdes, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00' AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING(docno, id) GROUP BY rev.docno) AS r USING(docno) ORDER BY overdue DESC, complete ASC";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);
    const ModifiedupdatedDeliverables = updatedDeliverables.map((deliverable) => {
      deliverable.rev = rev(deliverable.rev.substring(0, 1));
      return deliverable;
    });

    res.status(200).json({ result: pdqueryresult, deliverables: ModifiedupdatedDeliverables });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/updateIndexDropdowns', async (req, res) => {
  try {
    const projCode = [];
    const tsConnection = await createTsConnection();
    console.log("TS connection success")
    const tsQuery =
      "SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
      "FROM (dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid) " +
      "WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode";

    const tsResult = await executeTsQuery(tsConnection, tsQuery);
    console.log("TS connection success");

    tsResult.forEach((tsRow) => {
      const projCode = `tr_${tsRow.projectcode.toLowerCase()}`;

      allProjects[projCode] = `${tsRow.projectcode} - ${tsRow.clientname} - ${tsRow.projectname}`;
    });





    console.log("TS connection success")


    //await tsConnection.close();

    try {
      pdConnection = await createPdConnection();
      console.log("MYSQL Connection success");
    } catch (error) {
      console.error(`Error connecting to the database: ${error.message}`);
      console.log("MYSQL Connection unsuccessful");
      throw error;
    }

    const pdResult = await pdConnection.query('SHOW DATABASES');
    const pdRows = pdResult[0];



    const databases = [];
    const projectsWithoutDB = [];

    pdRows.forEach((pdRow) => {
      if (pdRow.Database.includes('tr')) {
        databases.push(pdRow.Database.toUpperCase().substring(3, pdRow.Database.length));
      }
    });


    ;

    for (const projCode in allProjects) {
      if (!databases.includes(projCode.toUpperCase().substring(3, projCode.length))) {
        projectsWithoutDB.push(projCode.toUpperCase().substring(3, projCode.length));
      }
    }


    const matchedObjects = [];

    // Iterate through each item in the first array
    databases.forEach(item => {
      // Find matching object in the second array
      const matchedObject = tsResult.find(obj => obj.projectcode === item);
      // If a matching object is found, push it to the matchedObjects array
      if (matchedObject) {
        var projCode = "tr_" + matchedObject.projectcode.toLowerCase();
        projects[projCode] = matchedObject.projectcode + "-" + matchedObject.clientname + "-" + matchedObject.projectname

      }
    });


    // Get an array of keys from allProjects and projects
    const allProjectKeys = Object.keys(allProjects);
    const projectKeys = Object.keys(projects);

    // Filter the allProjectKeys to keep only the keys that are not in projects
    const filteredProjectKeys = allProjectKeys.filter(key => !projectKeys.includes(key));

    // Construct a new object containing only the filtered projects
    const filteredProjects = {};
    filteredProjectKeys.forEach(key => {
      filteredProjects[key] = allProjects[key];
    });

    const sortedProjects = Object.fromEntries(Object.entries(projects).sort(([key1], [key2]) => key2.localeCompare(key1)));
    const sortedFilteredProjects = Object.fromEntries(Object.entries(filteredProjects).sort(([key1], [key2]) => key2.localeCompare(key1)));

    

    res.send({
      dbList: sortedProjects,
      allProjects: sortedFilteredProjects,

    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');

  }

});

app.get('/', async (req, res) => {
  try {
    const projCode = [];
    const tsConnection = await createTsConnection();
    console.log("TS connection success")
    const tsQuery =
      "SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
      "FROM (dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid) " +
      "WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode";

    const tsResult = await executeTsQuery(tsConnection, tsQuery);
    console.log("TS connection success");

    const allProjects = {};

    tsResult.forEach((tsRow) => {
      const projCode = `tr_${tsRow.projectcode.toLowerCase()}`;
      allProjects[projCode] = `${tsRow.projectcode} - ${tsRow.clientname} - ${tsRow.projectname}`;
    });

    console.log("TS connection success");

    try {
      pdConnection = await createPdConnection();
      console.log("MYSQL Connection success");
    } catch (error) {
      console.error(`Error connecting to the database: ${error.message}`);
      console.log("MYSQL Connection unsuccessful");
      throw error;
    }

    const pdResult = await pdConnection.query('SHOW DATABASES');
    const pdRows = pdResult[0];

    const databases = [];
    const projectsWithoutDB = [];

    pdRows.forEach((pdRow) => {
      if (pdRow.Database.includes('tr')) {
        databases.push(pdRow.Database.toUpperCase().substring(3, pdRow.Database.length));
      }
    });

    const projects = {};

    for (const projCode in allProjects) {
      if (!databases.includes(projCode.toUpperCase().substring(3, projCode.length))) {
        projectsWithoutDB.push(projCode.toUpperCase().substring(3, projCode.length));
      }
    }

    const matchedObjects = [];

    databases.forEach(item => {
      const matchedObject = tsResult.find(obj => obj.projectcode === item);
      if (matchedObject) {
        var projCode = "tr_" + matchedObject.projectcode.toLowerCase();
        projects[projCode] = matchedObject.projectcode + "-" + matchedObject.clientname + "-" + matchedObject.projectname;
      }
    });

    const allProjectKeys = Object.keys(allProjects);
    const projectKeys = Object.keys(projects);

    const filteredProjectKeys = allProjectKeys.filter(key => !projectKeys.includes(key));

    const filteredProjects = {};
    filteredProjectKeys.forEach(key => {
      filteredProjects[key] = allProjects[key];
    });

    // Sort projects and filteredProjects by keys in descending order
    const sortedProjects = Object.fromEntries(Object.entries(projects).sort(([key1], [key2]) => key2.localeCompare(key1)));
    const sortedFilteredProjects = Object.fromEntries(Object.entries(filteredProjects).sort(([key1], [key2]) => key2.localeCompare(key1)));

    

    res.render('index', {
      dbList: sortedProjects,
      allProjects: sortedFilteredProjects,
    });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});




app.post('/update-transmittal', async (req, res) => {
  const projdb = req.body.projdb;
  const docno = req.body.docno;
  const docname = req.body.docname;
  const issuedate = req.body.issuedate;
  const issuedateDate = new Date(issuedate);
  const issuedateFormatted = issuedateDate.toISOString().split('T')[0];
  const returndate = req.body.returndate;
  const transmitto = req.body.transmitto;
  const herocontact = req.body.herocontact;
  const issuedvia = req.body.issuedvia;
  const approval = parseInt(req.body.approval);
  const closeout = parseInt(req.body.closeout);
  const construction = parseInt(req.body.construction);
  const information = parseInt(req.body.information);
  const quotation = parseInt(req.body.quotation);
  const tender = parseInt(req.body.tender);
  var del = req.body.del;
  const remarks = req.body.remarks;
  const save = req.body.save;
  const tr = [];
  const insert = [];
  const deleteDel = [];


  if (del.length === 0) {
    del = [];

  }
  try {
    if (returndate && returndate.trim() !== '') {
      // Convert returndate to Date object
      const returndateDate = new Date(returndate);

      // Format returndate as YYYY-MM-DD
      const returndateFormatted = returndateDate.toISOString().split('T')[0];

      // Use the formatted returndate in the SQL query
      const pdQueryTrUpdate = await pdConnection.query(
        'INSERT INTO transmittals (docno, docname, issuedate, expretdate, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE docname=VALUES(docname), issuedate=VALUES(issuedate), expretdate=VALUES(expretdate), transmitto=VALUES(transmitto), herocontact=VALUES(herocontact), issuedvia=VALUES(issuedvia), approval=VALUES(approval), closeout=VALUES(closeout), construction=VALUES(construction), information=VALUES(information), quotation=VALUES(quotation), tender=VALUES(tender), remarks=VALUES(remarks)',
        [docno, docname, issuedateFormatted, returndateFormatted, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks]
      );


    } else {
      // If returndate is null or empty, insert '0000-00-00' into the database
      const pdQueryTrUpdate = await pdConnection.query(
        'INSERT INTO transmittals (docno, docname, issuedate, expretdate, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE docname=VALUES(docname), issuedate=VALUES(issuedate), expretdate=VALUES(expretdate), transmitto=VALUES(transmitto), herocontact=VALUES(herocontact), issuedvia=VALUES(issuedvia), approval=VALUES(approval), closeout=VALUES(closeout), construction=VALUES(construction), information=VALUES(information), quotation=VALUES(quotation), tender=VALUES(tender), remarks=VALUES(remarks)',
        [docno, docname, issuedateFormatted, '0000-00-00', transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks]
      );
    }
    const PdQueryDel = await pdConnection.query(`SELECT docno, revid FROM transdel WHERE trandocno = '${docno}'`);
    const td = PdQueryDel[0].map(item => {
      item.docId = item.docno + "|" + item.revid;
      return item.docId;

    });
    // Separate the logic for insertions, updates, and deletions
    const insertions = del.filter(x => !td.includes(x));
    const deletions = td.filter(x => !del.includes(x));
    // Handle insertions
    console.log("the del are: ", del);
    console.log("the insertions are:", insertions);
    console.log("the deletions are:", deletions);
    for (const item of insertions) {
      const [doc, reid] = item.split("|");
      try {
        // INSERT INTO transdel
        await pdConnection.query(`INSERT INTO transdel (trandocno, docno, revid) VALUES (?, ?, ?)`, [docno, doc, reid]);

        // UPDATE revisions with Issue Date
        await pdConnection.query(`UPDATE revisions SET issuedate=? WHERE id=?`, [issuedateFormatted, reid]);

        // UPDATE revNew with Issue Date
        await pdConnection.query(`UPDATE revNew SET issuedate=? WHERE id=?`, [issuedateFormatted, reid]);

        // Update Expected Return Date if necessary
        if (construction === 0 && closeout === 0 && information === 0) {
          console.log("BP1");
          if (returndate && returndate.trim() !== '') {
            // Convert returndate to Date object
            const returndateDate = new Date(returndate);

            // Format returndate as YYYY-MM-DD
            const returndateFormatted = returndateDate.toISOString().split('T')[0];
            await pdConnection.query(`UPDATE revisions SET expretdate=? WHERE id=?`, [returndateFormatted, reid]);
            await pdConnection.query(`UPDATE revNew SET expretdate=? WHERE id=?`, [returndateFormatted, reid]);

          }
        }
      } catch (err) {
        console.error(`Error during insertion: ${err.message}`);
        // Handle the error as needed
      }
    }

    for (const d of td) {
      console.log("break deletions")
      const [doc, reid] = d.split("|");
      try {
        // UPDATE Existing Revisions with Issue Date
        await pdConnection.query(`UPDATE revisions SET issuedate='${issuedateFormatted}' WHERE id=${reid}`);
        await pdConnection.query(`UPDATE revNew SET issuedate='${issuedateFormatted}' WHERE id=${reid}`);

        // UPDATE Existing Revisions with Expected Return Date
        if (returndate && returndate.trim() !== '') {
          const returndateDate = new Date(returndate);
          const returndateFormatted = returndateDate.toISOString().split('T')[0];
          await pdConnection.query(`UPDATE revisions SET expretdate='${returndateFormatted}' WHERE id=${reid}`);
          await pdConnection.query(`UPDATE revNew SET expretdate='${returndateFormatted}' WHERE id=${reid}`);
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
        // Handle the error as needed
      }
    }

    // Handle deletions
    for (const item of deletions) {
      const [doc, reid] = item.split("|");
      try {
        // DELETE FROM transdel
        await pdConnection.query(`DELETE FROM transdel WHERE trandocno = ? AND docno = ? AND revid = ?`, [docno, doc, reid]);

        // Reset Issue Date
        await pdConnection.query(`UPDATE revisions SET issuedate='0000-00-00' WHERE id=?`, [reid]);
        await pdConnection.query(`UPDATE revNew SET issuedate='0000-00-00' WHERE id=?`, [reid]);

        // Reset Expected Return Date
        await pdConnection.query(`UPDATE revisions SET expretdate='0000-00-00' WHERE id=?`, [reid]);
        await pdConnection.query(`UPDATE revNew SET expretdate='0000-00-00' WHERE id=?`, [reid]);
      } catch (err) {
        console.error(`Error during deletion: ${err.message}`);
        // Handle the error as needed
      }
    }


    const pdquery_tr = "(SELECT t.docno AS trno, t.docname AS trname, IF(complete = 1 OR t.returndate != '0000-00-00' AND cancelled = 0, 1, 0) as complete, t.cancelled, IF(t.expretdate <= curdate() AND t.returndate = '0000-00-00' AND complete = 0 AND cancelled = 0, 1, 0) AS overdue, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, GROUP_CONCAT(td.docno SEPARATOR '<br>') AS docno, GROUP_CONCAT(d.docname SEPARATOR '<br>') as docname, GROUP_CONCAT(CONCAT(r.revid,IFNULL(r.subrev,'')) SEPARATOR '<br>') AS rev FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id GROUP BY t.docno ORDER BY overdue DESC, complete ASC, cancelled ASC, issuedate DESC)";
    const pdresult_tr = await pdConnection.query(pdquery_tr);

    const modifiedResultTrans = pdresult_tr[0].map(transmittal => {
      const formattedItems = [];
      transmittal.returndate = formatDate(transmittal.returndate);
      if (transmittal.docno !== null && transmittal.docno !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.docno.includes('<br>')) {
          // If docno field contains multiple items, split it into an array
          transmittal.docno = transmittal.docno.split('<br>');
        } else {
          // If docno field contains only one item, create an array with a single item
          transmittal.docno = [transmittal.docno];
        }
        // Flatten the array to handle both cases
        transmittal.docno = transmittal.docno.flat();
        transmittal.total = transmittal.docno.length;
      } else {
        transmittal.docno = [''];
        transmittal.total = 0;
      }
      // Handling 'rev' field
      if (transmittal.rev !== null && transmittal.rev !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.rev.includes('<br>')) {
          transmittal.rev = transmittal.rev.split('<br>');
          for (let i = 0; i < transmittal.rev.length; i++) {
            transmittal.rev[i] = rev(parseInt(transmittal.rev[i].substring(0, 1)))[0];
          }
        } else {
          transmittal.rev = [rev(parseInt(transmittal.rev.substring(0, 1)))];
        }
        transmittal.rev = transmittal.rev.flat();
      } else {
        transmittal.rev = [''];
      }

      // Handling 'docname' field
      if (transmittal.docname !== null && transmittal.docname !== '') {
        if (typeof transmittal.docname === 'string' && transmittal.docname.includes('<br>')) {
          transmittal.docname = transmittal.docname.split('<br>');
        } else {
          transmittal.docname = [transmittal.docname];
        }
        transmittal.docname = transmittal.docname.flat();
      } else {
        transmittal.docname = [''];
      }

      // Assuming transmittal is an object with arrays docno, rev, and docname

      // Initialize an empty array to store formatted items


      // Iterate over the arrays in transmittal
      for (let i = 0; i < transmittal.docno.length; i++) {
        // Check if any of the properties are empty for the current index
        if (transmittal.docno[i] && transmittal.rev[i] && transmittal.docname[i]) {
          // If all properties are not empty, format the string and push it to formattedItems
          const formattedString = `${transmittal.docno[i]} - r.${transmittal.rev[i]} - ${transmittal.docname[i]}`;
          formattedItems.push(formattedString);
        }
      }

      // Assign the formattedItems array to transmitted_documents property of transmittal
      transmittal.transmitted_documents = formattedItems;


      return transmittal;
    });
    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00'	 AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid	FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno)";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);

    const ModifiedupdatedDeliverables = updatedDeliverables.map((deliverable) => {
      deliverable.rev = String(deliverable.rev).substring(0, 1);
      deliverable.rev = rev(parseInt(deliverable.rev));
      return deliverable;
    });


    res.status(200).json({
      transmittals: modifiedResultTrans, deliverables: ModifiedupdatedDeliverables
    })

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }



});

app.post('/createDatabase', async (req, res) => {
  const newproj = req.body.newproj;
  let values = [];
  let tables = [];
  if (newproj) {
    try {
      // Create the new database
      const createDatabaseQuery = `CREATE DATABASE IF NOT EXISTS ${newproj}`;
      await pdConnection.query(createDatabaseQuery);

      // Switch to the new database
      const useDatabaseQuery = `USE ${newproj}`;
      await pdConnection.query(useDatabaseQuery);

      // Create the tables
      const tableNames = Object.keys(dbinit);
      for (const tableName of tableNames) {
        const queryTables = dbinit[tableName];
        tables = await pdConnection.query(queryTables);
        // Execute the query here


      }
      const defaultValues = Object.keys(tblinit);
      for (const defaultValue of defaultValues) {
        const queryValues = tblinit[defaultValue];
        values = await pdConnection.query(queryValues);
        // Execute the query here

      }

      // Return a success message
      res.status(200).json({ database: newproj, tables: tableNames, values: defaultValues, message: 'Database and tables created successfully' });
    } catch (error) {
      // Log the error
      console.error(error);

      // Return an error message
      res.status(500).json({ message: 'Error creating database and tables' });
    }
  } else {
    // Return an error message
    res.status(400).json({ message: 'New project database is required' });
  }
});


app.get('/deliverables', async (req, res) => {
  const projdb = req.query.projdb;


  if (projdb) {
    console.log("The project database selected is: " + projdb + "\n" + "and there is a connection");
    try {
      // Establish database connection
      pdConnection = await createPdConnection(projdb);

      const pdquery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00'	 AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid	FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno)";
      const pdresult = await pdConnection.query(pdquery);

      const pdquery_tr = "(SELECT t.docno AS trno, t.docname AS trname, IF(complete = 1 OR t.returndate != '0000-00-00' AND cancelled = 0, 1, 0) as complete, t.cancelled, IF(t.expretdate <= curdate() AND t.returndate = '0000-00-00' AND complete = 0 AND cancelled = 0, 1, 0) AS overdue, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, GROUP_CONCAT(td.docno SEPARATOR '<br>') AS docno, GROUP_CONCAT(d.docname SEPARATOR '<br>') as docname, GROUP_CONCAT(CONCAT(r.revid,IFNULL(r.subrev,'')) SEPARATOR '<br>') AS rev FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id GROUP BY t.docno ORDER BY overdue DESC, complete ASC, cancelled ASC, issuedate DESC)";
      const pdresult_tr = await pdConnection.query(pdquery_tr);


      const modifiedPdResult = pdresult[0].map(deliverable => {
        deliverable.rev = rev(deliverable.rev);

        deliverable.revdate = formatDate(deliverable.revdate);

        deliverable.issuedate = formatDate(deliverable.issuedate);

        deliverable.expretdate = formatDate(deliverable.expretdate);

        deliverable.returndate = formatDate(deliverable.returndate);

        deliverable.schedate = formatDate(deliverable.schedate);

        return deliverable;

      });

      const modifiedResultTrans = pdresult_tr[0].map(transmittal => {
        const formattedItems = [];
        transmittal.returndate = formatDate(transmittal.returndate);
        if (transmittal.docno !== null && transmittal.docno !== '') {
          if (typeof transmittal.rev === 'string' && transmittal.docno.includes('<br>')) {
            // If docno field contains multiple items, split it into an array
            transmittal.docno = transmittal.docno.split('<br>');
          } else {
            // If docno field contains only one item, create an array with a single item
            transmittal.docno = [transmittal.docno];
          }
          // Flatten the array to handle both cases
          transmittal.docno = transmittal.docno.flat();
          transmittal.total = transmittal.docno.length;
        } else {
          transmittal.docno = [''];
          transmittal.total = 0;
        }
        // Handling 'rev' field
        if (transmittal.rev !== null && transmittal.rev !== '') {
          if (typeof transmittal.rev === 'string' && transmittal.rev.includes('<br>')) {
            transmittal.rev = transmittal.rev.split('<br>');
            for (let i = 0; i < transmittal.rev.length; i++) {
              transmittal.rev[i] = rev(parseInt(transmittal.rev[i].substring(0, 1)))[0];
            }
          } else {
            transmittal.rev = [rev(parseInt(transmittal.rev.substring(0, 1)))];
          }
          transmittal.rev = transmittal.rev.flat();
        } else {
          transmittal.rev = [''];
        }

        // Handling 'docname' field
        if (transmittal.docname !== null && transmittal.docname !== '') {
          if (typeof transmittal.docname === 'string' && transmittal.docname.includes('<br>')) {
            transmittal.docname = transmittal.docname.split('<br>');
          } else {
            transmittal.docname = [transmittal.docname];
          }
          transmittal.docname = transmittal.docname.flat();
        } else {
          transmittal.docname = [''];
        }

        // Assuming transmittal is an object with arrays docno, rev, and docname

        // Initialize an empty array to store formatted items

        // Iterate over the arrays in transmittal
        for (let i = 0; i < transmittal.docno.length; i++) {
          // Check if any of the properties are empty for the current index
          if (transmittal.docno[i] && transmittal.rev[i] && transmittal.docname[i]) {
            // If all properties are not empty, format the string and push it to formattedItems
            const formattedString = `${transmittal.docno[i]} - r.${transmittal.rev[i]} - ${transmittal.docname[i]}`;
            formattedItems.push(formattedString);
          }
        }

        // Assign the formattedItems array to transmitted_documents property of transmittal
        transmittal.transmitted_documents = formattedItems;


        return transmittal;
      });


      res.render('deliverables', {
        projdb: projdb,
        deliverables: modifiedPdResult,
        transmittals: modifiedResultTrans,

      });

    } catch (error) {
      console.error(`Error: ${error.message}`);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(400).send('No project database selected.');
  }
});

app.post('/docno', async (req, res) => {
  const { docno, alloc } = req.body;

  // Check if allocation exceeds the limit
  if (parseInt(alloc) > 100) {
    return res.status(400).send('Allocation exceeds 100!');
  }

  // Check if docno is provided
  if (!docno) {
    return res.status(400).send('Bad Request: docno is required');
  }

  try {
    // Fetch existing docnos
    const pddocnoquery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc as revdes, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00' AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING(docno, id) GROUP BY rev.docno) AS r USING(docno) ORDER BY overdue DESC, complete ASC";
    const pddocnoresult = await pdConnection.query(pddocnoquery);
    const docnos = pddocnoresult[0].map(doc_no => doc_no.docno);

    let docno_result = '';
    let alloc_result = '';

    const prefix = docno.substr(0, docno.lastIndexOf('-') + 1);
    const numStr = docno.substr(docno.lastIndexOf('-') + 1); // Extract the number part
    const sortedDocnos = docnos.filter(element => element.startsWith(prefix)).sort((a, b) => {
      const aNum = parseInt(a.match(/\d+$/)[0]);
      const bNum = parseInt(b.match(/\d+$/)[0]);
      return bNum - aNum;
    });
    if (docno.startsWith('DWG')) {
      const blocklimit = 100; // Assuming blocklimit for DWG
      // Find if the document number exists
      prefixToFind = docno.substr(0, docno.lastIndexOf('-') + 2);
      const foundIndex = sortedDocnos.findIndex((element) => {
        return element.includes(prefixToFind);
      });
      if (foundIndex !== -1) {
        // Document number exists, increment from the last numeric part
        const match = sortedDocnos[foundIndex].match(/\d+$/);
        if (match) {
          const doc_num = parseInt(match[0])
          const doc_num_inc = doc_num + 1;
          docno_result = prefix + doc_num_inc.toString().padStart(match[0].length, '0');
          // Increment alloc if within blocklimit
          if (parseInt(alloc) > 1 && parseInt(alloc) < blocklimit) {
            const doc_num_alloc = doc_num + parseInt(alloc);
            alloc_result = prefix + doc_num_alloc.toString().padStart(match[0].length, '0');
            return res.json({ docno: docno_result, docno2: alloc_result });
          }
          return res.json({ docno: docno_result, docno2: " " });

        }
        return null;

      } else {
        // Document number does not exist
        let doc_num;
        if (parseInt(numStr) === 0) {
          // If docno is 'DWG-0000', start at 'DWG-0001'
          doc_num = 1;
          docno_result = prefix + doc_num.toString().padStart(numStr.length, '0');
          if (parseInt(alloc) > 1 && parseInt(alloc) < blocklimit) {
            const doc_alloc = doc_num + parseInt(alloc);
            alloc_result = prefix + doc_alloc.toString().padStart(numStr.length, '0');
            return res.json({ docno: docno_result, docno2: alloc_result });
          }
          return res.json({ docno: docno_result, docno2: " " });
        } else {
          // If docno is not 'DWG-0000', find the maximum numeric part and increment
          doc_num = numStr;
          docno_result = prefix + doc_num.toString();
          if (parseInt(alloc) > 1 && parseInt(alloc) < blocklimit) {
            const doc_alloc = doc_num + parseInt(alloc);
            alloc_result = prefix + doc_alloc.toString().padStart(numStr.length, '0');
            return res.json({ docno: docno_result, docno2: alloc_result });
          }
          return res.json({ docno: docno_result, docno2: " " });
        }
        // Increment alloc if within blocklimit

      }
    } else {
      // Handle document types other than 'DWG'
      const drw_index = sortedDocnos.findIndex(element => element.startsWith(prefix));
      if (drw_index !== -1) {
        const match = sortedDocnos[drw_index].match(/\d+$/);
        if (match) {
          const doc_num = parseInt(match[0]) + 1;
          docno_result = prefix + doc_num.toString().padStart(match[0].length, '0');

          if (parseInt(alloc) > 1 && parseInt(alloc) < blocklimit) {
            const doc_alloc = doc_num + parseInt(alloc);
            alloc_result = prefix + doc_alloc.toString().padStart(match[0].length, '0');
            return res.json({ docno: docno_result, docno2: alloc_result });
          }
          return res.json({ docno: docno_result, docno2: "" });
        }
      } else {
        let doc_num = '0000';
        const num_inc = parseInt(doc_num) + 1;
        docno_result = prefix + num_inc.toString().padStart(doc_num.length, '0');

        if (parseInt(alloc) > 1 && parseInt(alloc) < blocklimit) {
          const doc_alloc = num_inc + parseInt(alloc);
          alloc_result = prefix + doc_alloc.toString().padStart(doc_num.length, '0');
          return res.json({ docno: docno_result, docno2: alloc_result });
        }
        return res.json({ docno: docno_result, docno2: "" });
      }
    }


  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});
app.post('/save-new-deliverable', async (req, res) => {
  try {
    const projdb = req.body.projdb && req.body.projdb.trim();
    const docno = req.body.docno && req.body.docno.trim();
    const sheets = parseInt(req.body.sheets) || 1;
    const docname = req.body.docname && req.body.docname.trim();
    const clientno = req.body.clientno;
    const alloc = parseInt(req.body.alloc) || 1;
    const safety = req.body.safety;
    const save = parseInt(req.body.save) || 1;
    const revdate = new Date();
    const schedate = new Date(0);

    if (!projdb) {
      return res.status(500).json({ error: 'Error adding deliverable: No project number received' });
    }

    if (!docno) {
      return res.status(500).json({ error: 'Error adding deliverable: No document number received' });
    }

    if (!docname) {
      return res.status(500).json({ error: 'Error adding deliverable: No document name received' });
    }

    for (let i = 0; i < alloc; i++) {
      const newDocNum = parseInt(docno.match(/\d+$/)[0]) + i;
      const docnoResult = docno.replace(/\d+$/, newDocNum.toString().padStart(docno.match(/\d+$/)[0].length, '0'));

      await pdConnection.query('INSERT INTO deliverables (docno, sheets, docname, clientno, safety) VALUES (?, ?, ?, ?, ?)', [docnoResult, sheets, docname, clientno, safety]);
      await pdConnection.query('INSERT INTO revisions (docno, revdate, revid, revdesc, schedate) VALUES (?, ?, ?, ?, ?)', [docnoResult, revdate, 1, 'Preliminary Design', '0000-00-00']);
      await pdConnection.query('INSERT INTO revNew (docno, revdate, rev, revdesc, schedate) VALUES (?, ?, ?, ?, ?)', [docnoResult, revdate, 'A', 'Preliminary Design', '0000-00-00']);
    }

    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00'	 AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid	FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno)";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);

    const ModifiedupdatedDeliverables = updatedDeliverables.map((deliverable) => {
      deliverable.rev = String(deliverable.rev).substring(0, 1);
      deliverable.rev = rev(parseInt(deliverable.rev));
      return deliverable;
    });


    res.status(200).json({ deliverables: ModifiedupdatedDeliverables });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/supersede', async (req, res) => {
  const projdb = req.body.projdb && req.body.projdb.trim();
  const docno = req.body.docno;
  const revdate = req.body.revdate;
  const revision = req.body.rev;
  const revid = req.body.revid;
  const schedate = req.body.schedate;
  const subrev = req.body.subrev;
  const revdesc = req.body.revdesc;

  if (projdb !== null || projdb !== "") {
    try {

      await pdConnection.query('INSERT INTO revisions (docno, revdate, revid, subrev, revdesc, schedate) VALUES (?,?,?,?,?,?)', [docno, revdate, revid, subrev, revdesc, schedate]);
      await pdConnection.query('INSERT INTO revNew (docno, revdate, rev, revdesc, schedate) VALUES (?,?,?,?,?)', [docno, revdate, revision, revdesc, schedate]);
      const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc as revdes, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00' AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING(docno, id) GROUP BY rev.docno) AS r USING(docno) ORDER BY overdue DESC, complete ASC";
      const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);
      const ModifiedupdatedDel = updatedDeliverables.map((deliverable) => {
        deliverable.rev = rev(deliverable.rev);
        return deliverable;
      });

      res.status(200).json({ deliverables: ModifiedupdatedDel });
    } catch (error) {
      console.error(`Error: ${error.message}`);
      res.status(500).send('Internal Server Error');
    }
  } else {
    res.status(400).send('No project database selected.');
  }
});

app.get('/dropdown-options', async (req, res) => {
  const safetyValue = parseInt(req.query.safety);

  try {
    const pdquery_type_dv = "SELECT * FROM doctype WHERE type NOT LIKE 'TR' ORDER BY type";
    const pdresult_type_dv = await pdConnection.query(pdquery_type_dv);
    const filteredOptions = pdresult_type_dv[0].filter(option => option.safety === safetyValue);
    const options = filteredOptions.map(option => option.type + '-' + option.typedesc);
    res.status(200).send({ options: options });


  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/revision-options', async (req, res) => {

  var projdb = req.body.projdb;
  var largestRev = parseInt(req.body.largestRev);
  if (!projdb) {
    return res.status(500).json({ error: 'Error adding retrieving revisions: No project number or document number received' });
  }
  try {
    let revisionquery = "SELECT * FROM revisiondef";
    let revisionresult = await pdConnection.query(revisionquery);
    const ModifiedupdatedRev = revisionresult[0]
      .filter(revision => revision.revid >= largestRev)
      .sort((a, b) => a.revid - b.revid);
    res.status(200).json({ revision: ModifiedupdatedRev });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/past-revisions', async (req, res) => {

  var projdb = req.body.projdb;
  var docno = req.body.docno;

  if (!projdb || !docno) {
    return res.status(500).json({ error: 'Error retrieving past revisions: No project number or document number received' });
  }
  try {
    const query = "SELECT deliverables.docno AS docno, docname, revisions.revid AS rev, revisions.subrev, revisions.revdate, revisions.revdesc, revisions.schedate FROM deliverables LEFT JOIN revisions USING (docno) WHERE docno = '" + docno + "' ORDER BY rev DESC, subrev DESC";
    const queryresult = await pdConnection.query(query);

    const ModifiedupdatedRevHis = queryresult[0].map((revision) => {
      revision.revdesc = rev(revision.rev);
      revision.latestrevid = revision.rev;
      return revision;
    });

    let largestLatestRevid = 0;
    ModifiedupdatedRevHis.forEach((revision) => {
      if (revision.latestrevid > largestLatestRevid) {
        largestLatestRevid = revision.latestrevid;
      }
    });

    res.status(200).json({ pastrevisions: ModifiedupdatedRevHis, largestLatestRevid: largestLatestRevid });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});


app.get('/drawing-options', async (req, res) => {
  try {
    const pdquery_drawingtype = "SELECT * FROM drawingtype ORDER BY type";
    const pdresult_drawingtype = await pdConnection.query(pdquery_drawingtype);
    const drawingTypes = pdresult_drawingtype[0].map(type_r => type_r.type + '-' + type_r.typedesc);

    const pdquery_drawingblck = "SELECT * FROM drawingblock ORDER BY id";
    const pdresult_drawingblck = await pdConnection.query(pdquery_drawingblck);
    const drawingblck = pdresult_drawingblck[0].map(row => row.blockdesc);

    res.json({ options: drawingTypes, blocks: drawingblck });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.get('/skm-options', async (req, res) => {
  try {
    const pdquery_skm = "SELECT * FROM skmtype ORDER BY type";
    const pdresult_skm = await pdConnection.query(pdquery_skm);
    const skm = pdresult_skm[0].map(skm_row => skm_row.type + '-' + skm_row.typedesc);

    res.json({ options: skm });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }



});


app.post('/add-transmittal', async (req, res) => {
  const docno = req.body.docno;
  const docname = req.body.docname;
  const issuedate = req.body.issuedate;
  const returndate = req.body.returndate;
  const issuedateDate = new Date(issuedate);
  const issuedateFormatted = issuedateDate.toISOString().split('T')[0];
  const transmitto = req.body.transmitto;
  const herocontact = req.body.herocontact;
  const issuedvia = req.body.issuedvia;
  const approval = parseInt(req.body.approval);
  const closeout = parseInt(req.body.closeout);
  const construction = parseInt(req.body.construction);
  const information = parseInt(req.body.information);
  const quotation = parseInt(req.body.quotation);
  const tender = parseInt(req.body.tender);
  var del = req.body.del;
  const remarks = req.body.remarks;
  const save = req.body.save;
  const tr = [];
  const insert = [];
  const deleteDel = [];


  if (del.length === 0) {
    del = [];

  }
  try {
    // Check if returndate is not null and not an empty string
    if (returndate && returndate.trim() !== '') {
      // Convert returndate to Date object
      const returndateDate = new Date(returndate);

      // Format returndate as YYYY-MM-DD
      const returndateFormatted = returndateDate.toISOString().split('T')[0];

      // Use the formatted returndate in the SQL query
      const pdQueryTrUpdate = await pdConnection.query(
        'INSERT INTO transmittals (docno, docname, issuedate, expretdate, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE docname=VALUES(docname), issuedate=VALUES(issuedate), expretdate=VALUES(expretdate), transmitto=VALUES(transmitto), herocontact=VALUES(herocontact), issuedvia=VALUES(issuedvia), approval=VALUES(approval), closeout=VALUES(closeout), construction=VALUES(construction), information=VALUES(information), quotation=VALUES(quotation), tender=VALUES(tender), remarks=VALUES(remarks)',
        [docno, docname, issuedateFormatted, returndateFormatted, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks]
      );
    } else {
      // If returndate is null or empty, insert '0000-00-00' into the database
      const pdQueryTrUpdate = await pdConnection.query(
        'INSERT INTO transmittals (docno, docname, issuedate, expretdate, transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?) ON DUPLICATE KEY UPDATE docname=VALUES(docname), issuedate=VALUES(issuedate), expretdate=VALUES(expretdate), transmitto=VALUES(transmitto), herocontact=VALUES(herocontact), issuedvia=VALUES(issuedvia), approval=VALUES(approval), closeout=VALUES(closeout), construction=VALUES(construction), information=VALUES(information), quotation=VALUES(quotation), tender=VALUES(tender), remarks=VALUES(remarks)',
        [docno, docname, issuedateFormatted, '0000-00-00', transmitto, herocontact, issuedvia, approval, closeout, construction, information, quotation, tender, remarks]
      );
    }
    const PdQueryDel = await pdConnection.query(`SELECT docno, revid FROM transdel WHERE trandocno = '${docno}'`);
    const td = PdQueryDel[0].map(item => {
      item.docId = item.docno + "|" + item.revid;
      return item.docId;

    });

    // Separate the logic for insertions, updates, and deletions
    const insertions = del.filter(x => !td.includes(x));
    const deletions = td.filter(x => !del.includes(x));

    console.log("the insertions are:", insertions);
    console.log("the deletions are:", deletions);


    // Handle insertions
    for (const item of insertions) {
      const [doc, reid] = item.split("|");
      try {
        // INSERT INTO transdel
        await pdConnection.query(`INSERT INTO transdel (trandocno, docno, revid) VALUES (?, ?, ?)`, [docno, doc, reid]);

        // UPDATE revisions with Issue Date
        await pdConnection.query(`UPDATE revisions SET issuedate=? WHERE id=?`, [issuedateFormatted, reid]);

        // UPDATE revNew with Issue Date
        await pdConnection.query(`UPDATE revNew SET issuedate=? WHERE id=?`, [issuedateFormatted, reid]);

        // Update Expected Return Date if necessary
        if (construction === 0 && closeout === 0 && information === 0) {
          console.log("BP1");
          if (returndate && returndate.trim() !== '') {
            // Convert returndate to Date object
            const returndateDate = new Date(returndate);

            // Format returndate as YYYY-MM-DD
            const returndateFormatted = returndateDate.toISOString().split('T')[0];
            await pdConnection.query(`UPDATE revisions SET expretdate=? WHERE id=?`, [returndateFormatted, reid]);
            await pdConnection.query(`UPDATE revNew SET expretdate=? WHERE id=?`, [returndateFormatted, reid]);

          }
        }
      } catch (err) {
        console.error(`Error during insertion: ${err.message}`);
        // Handle the error as needed
      }
    }

    // Handle deletions
    for (const item of deletions) {
      const [doc, reid] = item.split("|");
      try {
        // DELETE FROM transdel
        await pdConnection.query(`DELETE FROM transdel WHERE trandocno = ? AND docno = ? AND revid = ?`, [docno, doc, reid]);

        // Reset Issue Date
        await pdConnection.query(`UPDATE revisions SET issuedate='0000-00-00' WHERE id=?`, [reid]);
        await pdConnection.query(`UPDATE revNew SET issuedate='0000-00-00' WHERE id=?`, [reid]);

        // Reset Expected Return Date
        await pdConnection.query(`UPDATE revisions SET expretdate='0000-00-00' WHERE id=?`, [reid]);
        await pdConnection.query(`UPDATE revNew SET expretdate='0000-00-00' WHERE id=?`, [reid]);
      } catch (err) {
        console.error(`Error during deletion: ${err.message}`);
        // Handle the error as needed
      }
    }


    const pdquery_tr = "(SELECT t.docno AS trno, t.docname AS trname, IF(complete = 1 OR t.returndate != '0000-00-00' AND cancelled = 0, 1, 0) as complete, t.cancelled, IF(t.expretdate <= curdate() AND t.returndate = '0000-00-00' AND complete = 0 AND cancelled = 0, 1, 0) AS overdue, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, GROUP_CONCAT(td.docno SEPARATOR '<br>') AS docno, GROUP_CONCAT(d.docname SEPARATOR '<br>') as docname, GROUP_CONCAT(CONCAT(r.revid,IFNULL(r.subrev,'')) SEPARATOR '<br>') AS rev FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id GROUP BY t.docno ORDER BY overdue DESC, complete ASC, cancelled ASC, issuedate DESC)";
    const pdresult_tr = await pdConnection.query(pdquery_tr);

    const modifiedResultTrans = pdresult_tr[0].map(transmittal => {
      const formattedItems = [];
      transmittal.returndate = formatDate(transmittal.returndate);
      if (transmittal.docno !== null && transmittal.docno !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.docno.includes('<br>')) {
          // If docno field contains multiple items, split it into an array
          transmittal.docno = transmittal.docno.split('<br>');
        } else {
          // If docno field contains only one item, create an array with a single item
          transmittal.docno = [transmittal.docno];
        }
        // Flatten the array to handle both cases
        transmittal.docno = transmittal.docno.flat();
        transmittal.total = transmittal.docno.length;
      } else {
        transmittal.docno = [''];
        transmittal.total = 0;
      }
      // Handling 'rev' field
      if (transmittal.rev !== null && transmittal.rev !== '') {
        if (typeof transmittal.rev === 'string' && transmittal.rev.includes('<br>')) {
          transmittal.rev = transmittal.rev.split('<br>');
          for (let i = 0; i < transmittal.rev.length; i++) {
            transmittal.rev[i] = rev(parseInt(transmittal.rev[i].substring(0, 1)))[0];
          }
        } else {
          transmittal.rev = [rev(parseInt(transmittal.rev.substring(0, 1)))];
        }
        transmittal.rev = transmittal.rev.flat();
      } else {
        transmittal.rev = [''];
      }

      // Handling 'docname' field
      if (transmittal.docname !== null && transmittal.docname !== '') {
        if (typeof transmittal.docname === 'string' && transmittal.docname.includes('<br>')) {
          transmittal.docname = transmittal.docname.split('<br>');
        } else {
          transmittal.docname = [transmittal.docname];
        }
        transmittal.docname = transmittal.docname.flat();
      } else {
        transmittal.docname = [''];
      }

      // Assuming transmittal is an object with arrays docno, rev, and docname

      // Initialize an empty array to store formatted items


      // Iterate over the arrays in transmittal
      for (let i = 0; i < transmittal.docno.length; i++) {
        // Check if any of the properties are empty for the current index
        if (transmittal.docno[i] && transmittal.rev[i] && transmittal.docname[i]) {
          // If all properties are not empty, format the string and push it to formattedItems
          const formattedString = `${transmittal.docno[i]} - r.${transmittal.rev[i]} - ${transmittal.docname[i]}`;
          formattedItems.push(formattedString);
        }
      }

      // Assign the formattedItems array to transmitted_documents property of transmittal
      transmittal.transmitted_documents = formattedItems;


      return transmittal;
    });
    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00'	 AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid	FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno)";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);

    const ModifiedupdatedDeliverables = updatedDeliverables.map((deliverable) => {
      deliverable.rev = String(deliverable.rev).substring(0, 1);
      deliverable.rev = rev(parseInt(deliverable.rev));
      return deliverable;
    });


    res.status(200).json({
      transmittals: modifiedResultTrans, deliverables: ModifiedupdatedDeliverables
    })

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.post('/new-transmittal-details', async (req, res) => {
  try {
    const tsDetailsquery = "SELECT clientname FROM projectdetails";
    const tsDetailsresult = await pdConnection.query(tsDetailsquery);


    let tsDetails = []; // Initialize tsDetails outside the if statement

    if (Array.isArray(tsDetailsresult[0]) && tsDetailsresult[0].length > 0) {
      tsDetails = tsDetailsresult[0].map(tsDetails_row => {
        tsDetails_row.clientname = "<contact name>" + " " + "-" + " " + (tsDetails_row.clientname !== '' && tsDetails_row.clientname !== null ? tsDetails_row.clientname : '');
        return tsDetails_row;
      });
    }

    const tsDetailsDelQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc, revisions.issuedate, revisions.returndate FROM (SELECT DISTINCT docno, max(id) AS id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING (docno, id) GROUP BY rev.docno) AS r USING (docno) WHERE issuedate = '0000-00-00' and returndate = '0000-00-00'"
    const tsDetailsDelQueryResult = await pdConnection.query(tsDetailsDelQuery);

    const trIssued_Addel = tsDetailsDelQueryResult[0].map(trIssued => {
      trIssued.rev = rev(parseInt(trIssued.rev));
      trIssued.rev = trIssued.subrev !== null && trIssued.subrev !== ' ' ? trIssued.rev[0] + "." + trIssued.subrev : trIssued.rev[0];
      trIssued.desc = (trIssued.docno !== null && trIssued.rev !== null && trIssued.docname !== null) ? trIssued.docno + "-" + "r." + trIssued.rev + "-" + trIssued.docname : '';
      return trIssued;
    });

    res.status(200).json({ tsDetailsCName: tsDetails, addel: trIssued_Addel });
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});


app.post('/update-deliverable', async (req, res) => {
  try {

    const docno = req.body.docno;
    const sheets = parseInt(req.body.sheets) || 1;
    const docname = req.body.docname;
    const clientno = req.body.clientno && req.body.clientno.trim() ? req.body.clientno : "";
    const safety = req.body.safety;
    const queryString = await pdConnection.query(
      'UPDATE deliverables SET sheets = ?, docname = ?, clientno = ?, safety = ? WHERE docno = ?',
      [sheets, docname, clientno, safety, docno]
    );

    // Send a response to the client

    const updatedDeliverablesQuery = "SELECT * FROM deliverables LEFT JOIN (SELECT rev.docno, revisions.id as revid, rev.revid as rev, revisions.revdate, max(revisions.subrev) as subrev, revisions.revdesc as revdes, revisions.schedate, revisions.issuedate, revisions.expretdate, revisions.returndate, IF(revisions.returndate <> '0000-00-00', 1, 0) AS complete, IF((revisions.expretdate <= curdate() AND revisions.returndate = '0000-00-00' AND revisions.expretdate <> '0000-00-00') OR (revisions.schedate <= curdate() AND revisions.issuedate = '0000-00-00' AND revisions.schedate <> '0000-00-00'), 1, 0) AS overdue FROM (SELECT DISTINCT docno, max(id) as id, max(revid) AS revid FROM revisions GROUP BY docno) AS rev LEFT JOIN revisions USING(docno, id) GROUP BY rev.docno) AS r USING(docno) ORDER BY overdue DESC, complete ASC";
    const [updatedDeliverables] = await pdConnection.query(updatedDeliverablesQuery);
    const ModifiedupdatedDel = updatedDeliverables.map((deliverable) => {
      deliverable.rev = rev(deliverable.rev.length > 1 ? deliverable.rev.substring(0, 1) : deliverable.rev);
      return deliverable;
    });
    res.status(200).json({ deliverables: ModifiedupdatedDel });




  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }

});








app.post('/view-pdf', async (req, res) => {
  const docno = req.body.docno;
  const projno = req.body.projdb;
  const units = 2.85;
  try {
    const existingPdfBytes = await fs.readFile("public/transmittal-template.pdf");
    const pdfDoc = await PDFDocument.load(existingPdfBytes);

    // Register fontkit instance
    pdfDoc.registerFontkit(fontkit);

    // Embed custom font
    const fontBytes = await fs.readFile("public/font/times new roman.ttf");
    const customFont = await pdfDoc.embedFont(fontBytes);
    const page = pdfDoc.getPages()[0];
    const height = page.getSize().height;
    const width = page.getSize().width;

    const pdquery = await pdConnection.query(`SELECT t.docno AS trno, t.docname AS trname, t.issuedate, t.expretdate, t.returndate, t.transmitto, t.herocontact, t.issuedvia, t.approval, t.closeout, t.construction, t.information, t.quotation, t.tender, t.remarks, td.docno AS docno, d.clientno AS clientno, d.docname AS docname, CONCAT(r.revid,IFNULL(r.subrev,'')) AS rev, td.revid AS revid FROM ((transmittals AS t LEFT JOIN transdel AS td ON t.docno = td.trandocno) LEFT JOIN deliverables AS d ON d.docno=td.docno) LEFT JOIN revisions AS r ON td.revid = r.id WHERE t.docno = '${docno}'`);

    for (let index = 0; index < pdquery[0].length; index++) {
      const modification = pdquery[0][index];
      const pageIdx = index % 24;

      if (modification && typeof modification === "object") {

        if (pageIdx === 0) {


          page.setFont(customFont);
          pdfDoc.setTitle(projno.replace(/"/g, '').toUpperCase() + "-" + modification.trno);
          pdfDoc.setAuthor(modification.herocontact);
          pdfDoc.setSubject(
            "Transmittal " +
            modification.trno +
            " to " +
            modification.transmitto +
            " via " +
            modification.issuedvia +
            " on " +
            modification.issuedate.replace(/-/g, "/")
          );
          pdfDoc.setCreator("Hero Engineering Project Database");

          if (modification.cancelled === 1 && modification.cancelled) {
            page.drawText("CANCELLED", {
              x: 0,
              y: 0,
              size: 32,
              font: customFont,
              color: rgb(255, 0, 0),
            });
          }


          page.drawText("Page " + (index + 1) + " of " + "1", {
            x: (width / 2) * units,
            y: 50 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),

          });
          page.drawText(projno.replace(/"/g, '').substring(3, projno.replace(/"/g, '').length).toUpperCase() + "-" + modification.trno.toUpperCase(), {
            x: 110 * units,
            y: (height - 43 * units),
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),

          });

          page.drawText(modification.issuedate.replace(/-/g, '/'), {
            x: 110 * units,
            y: height - 51 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),
            width: 75,
          });
          page.drawText(modification.transmitto, {
            x: 24 * units,
            y: height - 63 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),
            lineHeight: 4.225,
            width: 79,
          });

          page.drawText(modification.herocontact, {
            x: 103.5 * units,
            y: height - 65 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),
          });

          page.drawText(modification.issuedvia, {
            x: 24 * units,
            y: height - 87 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),
            lineHeight: 4.225,
          });

          if (modification.approval === 1) {
            page.drawText("X", {
              x: 105 * units,
              y: height - 90 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          if (modification.closeout === 1) {
            page.drawText("X", {
              x: 132 * units,
              y: height - 90 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          if (modification.construction === 1) {
            page.drawText("X", {
              x: 157 * units,
              y: height - 90 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          if (modification.information === 1) {
            page.drawText("X", {
              x: 105 * units,
              y: height - 96 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          if (modification.quotation === 1) {
            page.drawText("X", {
              x: 132 * units,
              y: height - 96 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }
          if (modification.tender === 1) {
            page.drawText("X", {
              x: 157 * units,
              y: height - 96 * units,
              size: 8,
              font: customFont,
              color: rgb(0, 0, 0),
            });
          }

          const remarksText = "Respond by: " + modification.expretdate.replace(/-/g, "/");
          page.drawText(remarksText, {
            x: 24 * units,
            y: height - 219 * units,
            size: 8,
            font: customFont,
            color: rgb(0, 0, 0),
          });
        }

        const v = [
          modification.rev,
          modification.revid,
          modification.docname,
        ];
        const k =
          modification.clientno !== null && modification.clientno !== ''
            ? modification.clientno
            : projno.replace(/"/g, '').toUpperCase().substring(3, projno.replace(/"/g, '').toUpperCase().length) + "-" + (modification.docno !== null && modification.docno !== '' ? modification.docno : '');
        const j = 111 + index * 4.225;

        page.drawText(String(index + 1), {
          x: 30 * units,
          y: height - j * units,
          size: 7,
          font: customFont,
          color: rgb(0, 0, 0),
          textAlign: 'center'
        });

        page.drawText(k, {
          x: 50 * units,
          y: height - j * units,
          size: 7,
          font: customFont,
          color: rgb(0, 0, 0),
          textAlign: 'center'
        });


        page.drawText(v[0] !== '' && v[0] !== null ? rev(parseInt(v[0].substring(0, 1)))[0] + v[0].substring(1) : '-', {
          x: 90 * units,
          y: height - j * units,
          size: 7,
          font: customFont,
          color: rgb(0, 0, 0),
          textAlign: 'center'
        });

        const fontSize = 32;
        if (v[2] !== '' && v[2] !== null) {
          if (v[2].length > 83) {
            page.drawText(
              "..." + v[2].substring(0, v[2].length - 39),
              {
                x: 104.5 * units,
                y: height - j * units,
                size: 7,
                font: customFont,
                color: rgb(0, 0, 0),
                textAlign: 'center'
              }
            );
          } else {
            page.drawText(v[2], {
              x: 104.5 * units,
              y: height - j * units,
              size: 7,
              font: customFont,
              color: rgb(0, 0, 0),
              textAlign: 'center'
            });

          }
        } else {
          page.drawText("-", {
            x: 104.5 * units,
            y: height - j * units,
            size: 7,
            font: customFont,
            color: rgb(0, 0, 0),
            textAlign: 'center'
          });

        }


      }

    }

    // Serialize the modified PDF document to bytes
    const modifiedPdfBytes = await pdfDoc.save();

    // Set the response headers for downloading
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="transmittal-${docno}.pdf"`);

    // Send the modified PDF bytes for download
    res.end(modifiedPdfBytes, 'binary');
  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});




app.post('/return-deliverable', async (req, res) => {
  const docno = req.body.docno;
  try {
    const query = "SELECT d.docno, CONCAT(r.revid,IFNULL(r.subrev,'')) AS rev, r.id as revid, d.docname as docname, r.issuedate as issuedate FROM (revisions AS r LEFT JOIN deliverables AS d USING (docno)) WHERE r.issuedate != '0000-00-00' AND r.returndate = '0000-00-00'";
    const [returndelQuery] = await pdConnection.query(query);
    const remDel = returndelQuery.filter(
      (deliverable) => {
        return deliverable.docno === docno;
      }

    )

    const addDel = returndelQuery.filter(
      (deliverable) => {
        return deliverable.docno !== docno;
      });


    const returnedDeliverablesFiltered = addDel.map(
      (deliverable) => {
        deliverable.rev = rev(parseInt(deliverable.rev.substring(0, 1)));
        deliverable.r = "r." + deliverable.rev[0];
        deliverable.optionValue = deliverable.docno + "-" + deliverable.r + "-" + deliverable.docname;
        return deliverable;
      }
    );

    const returndelQueryUpdated = remDel.map(
      (deliverable) => {
        deliverable.rev = rev(parseInt(deliverable.rev.substring(0, 1)));

        deliverable.r = "r." + deliverable.rev[0];
        deliverable.optionValue = deliverable.docno + "-" + deliverable.r + "-" + deliverable.docname;
        return deliverable;
      });

    res.status(200).send({ filteredDeliverables: returnedDeliverablesFiltered, removedDeliverables: returndelQueryUpdated });

  } catch (error) {
    console.error(`Error: ${error.message}`);
    res.status(500).send('Internal Server Error');
  }
});

app.listen(3000, function () {
  console.log('Example app listening on port 3000!');
});



function rev(rev) {
  switch (rev) {
    case 1:
      return ["A", "Preliminary Design"];
    case 2:
      return ["B", "Internal Review"];
    case 3:
      return ["C", "Client Review"];
    case 4:
      return ["D", "Client Review"];
    case 5:
      return ["0", "Issued For Construction"];
    case 6:
      return ["1", "Asbuilt"];
    case 9:
      return ["E", "Client Review"];
    case 10:
      return ["F", "Client Review"];
    case 11:
      return ["G", "Client Review"];
    case 12:
      return ["0B", "Issued For Construction"];
    case 17:
      return ["3", "Issued For Use"];

    default:
      return;
  }
}

function formatDate(dateString) {
  if (dateString === '0000-00-00' || dateString === '1899-11-29') {
    return '0000-00-00';
  }
  const date = new Date(dateString);
  const year = date.getUTCFullYear();
  const month = String(date.getUTCMonth() + 1).padStart(2, '0');
  const day = String(date.getUTCDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}


//----------------------   EUC Endpoints---------------------------------------------------//
app.get('/euc', (req, res) => {
  res.render('euc'); // Render euc.ejs for the '/euc' page
});

// Endpoint to handle GET request for EUC data
app.get('/getEUC.php', async (req, res) => {
  // Logic to fetch EUC data from the server or database
});

// Endpoint to handle POST request to save EUC data
app.post('/saveEUC.php', async (req, res) => {
  // Logic to save EUC data received in the request body
});

app.post('/updateEUC', async (req,res) => {

});

// Endpoint to handle GET request for owners data
app.get('/getOwners.php', async (req, res) => {
  // Logic to fetch owners data from the server or database
});

// Endpoint to handle POST request to save owners data
app.post('/saveOwners.php', async (req, res) => {
  // Logic to save owners data received in the request body
});

// Endpoint to handle GET request for documents data
app.get('/getDoc.php', async (req, res) => {
  // Logic to fetch documents data from the server or database
});

// Endpoint to handle POST request to save documents data
app.post('/saveDoc.php', async (req, res) => {
  // Logic to save documents data received in the request body
});

// Endpoint to handle GET request for MRQ data
app.get('/getMRQ.php', async (req, res) => {
  // Logic to fetch MRQ data from the server or database
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
