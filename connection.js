const { Connection, Request, TYPES } = require('tedious');

const config = {
  server: '192.168.0.5', // update me
  authentication: {
    type: 'default',
    options: {
      userName: 'sa', // update me
      password: 'T1mesit3' // update me
    }
  },
  options: {
    encrypt: false,
    database: 'TIMESITE' // update me
  }
};

const connection = new Connection(config);

connection.on('connect', function(err) {
  if (err) {
    console.error('Error:', err);
  } else {
    console.log("Connected");
    executeStatement(); // Call the function to execute the SQL statement
  }
});

connection.connect();

function executeStatement() {
  const request = new Request(
    "SELECT projectid, dbo.tblclient.clientid, clientname, projectcode, projectname " +
    "FROM (dbo.tblproject JOIN dbo.tblclient ON dbo.tblproject.clientid = dbo.tblclient.clientid) " +
    "WHERE projectcode != '' AND projectcode LIKE '%P%' ORDER BY projectcode",
    function(err) {
      if (err) {
        console.error(err);
      }
    }
  );

  const projects = {};

  request.on('row', function(columns) {
    let projCode = "";
    columns.forEach(function(column) {
      if (column.metadata.colName === 'projectcode') {
        projCode = `tr_${column.value.toLowerCase()}`;
      }
      projects[projCode] = `${column.value} - ${columns[2].value} - ${columns[4].value}`;
    });
  });

  request.on('requestCompleted', function() {
    console.log("Projects with databases:");
    console.log(projects);

    connection.close();
  });

  connection.execSql(request);
}
