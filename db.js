const mysql = require('mysql2/promise');
const odbc = require('odbc');

// Project Database DB parameters
const pdServer = "192.168.0.169";
const pdUser = "dbserver";
const pdPass = "hero123@";

// TimeSite Database DB parameters
const tsConfig = {
  connectionString: 'Driver=SQL Server; Server=HEROW2K8\\TIMESITE; Port=1433; Database=TIMESITE; UID=sa; PWD=T1mesit3'
};

const pdConfig = (databaseName) => ({
  host: pdServer,
  port: 3306,
  user: pdUser,
  password: pdPass,
  database: databaseName,
  connectTimeout: 60000,
  dateStrings: true
});

const dbinit = {
  "deliverables": `
      CREATE TABLE deliverables (
          docno VARCHAR(45) NOT NULL,
          sheets INT(11) DEFAULT NULL,
          docname VARCHAR(255) DEFAULT NULL,
          clientno VARCHAR(255) DEFAULT NULL,
          safety INT(11) DEFAULT 0 NOT NULL,
          PRIMARY KEY (docno),
          UNIQUE KEY docno_UNIQUE (docno)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "doctype": `
      CREATE TABLE doctype (
          id INT(11) NOT NULL,
          type VARCHAR(45) NOT NULL,
          typedesc VARCHAR(45) NOT NULL,
          safety INT(11) DEFAULT 0 NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY type_UNIQUE (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "drawingblock": `
      CREATE TABLE drawingblock (
          id INT(11) NOT NULL,
          blockdesc VARCHAR(45) NOT NULL,
          PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "drawingtype": `
      CREATE TABLE drawingtype (
          id INT(11) NOT NULL AUTO_INCREMENT,
          type VARCHAR(45) NOT NULL,
          typedesc VARCHAR(45) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY type_UNIQUE (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "projectdetails": `
      CREATE TABLE projectdetails (
          projectcode VARCHAR(15) NOT NULL,
          projectname VARCHAR(255) NOT NULL,
          clientname VARCHAR(45) NOT NULL,
          contactperson VARCHAR(45) DEFAULT NULL,
          PRIMARY KEY (projectcode),
          UNIQUE KEY projectcode_UNIQUE (projectcode)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "revisiondef": `
      CREATE TABLE revisiondef (
          revid INT(11) NOT NULL AUTO_INCREMENT,
          rev VARCHAR(45) NOT NULL,
          revdesc VARCHAR(45) NOT NULL,
          PRIMARY KEY (revid),
          UNIQUE KEY rev_UNIQUE (rev)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "revisions": `
      CREATE TABLE revisions (
          id INT(11) NOT NULL AUTO_INCREMENT,
          docno VARCHAR(45) NOT NULL,
          revdate DATE DEFAULT '0000-00-00',
          revid INT(11) NOT NULL,
          subrev VARCHAR(15) DEFAULT NULL,
          revdesc VARCHAR(45) DEFAULT NULL,
          schedate DATE DEFAULT '0000-00-00',
          issuedate DATE DEFAULT '0000-00-00',
          returndate DATE DEFAULT '0000-00-00',
          expretdate DATE DEFAULT '0000-00-00',
          PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "revNew": `
      CREATE TABLE revNew (
          id INT(11) NOT NULL AUTO_INCREMENT,
          docno VARCHAR(45) NOT NULL,
          rev VARCHAR(15) DEFAULT NULL,
          revdate DATE DEFAULT '0000-00-00',
          revdesc VARCHAR(45) DEFAULT NULL,
          schedate DATE DEFAULT '0000-00-00',
          issuedate DATE DEFAULT '0000-00-00',
          returndate DATE DEFAULT '0000-00-00',
          expretdate DATE DEFAULT '0000-00-00',
          PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "skmtype": `
      CREATE TABLE skmtype (
          id INT(11) NOT NULL,
          type VARCHAR(45) NOT NULL,
          typedesc VARCHAR(45) NOT NULL,
          PRIMARY KEY (id),
          UNIQUE KEY type_UNIQUE (type)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "transdel": `
      CREATE TABLE transdel (
          id INT(11) NOT NULL AUTO_INCREMENT,
          trandocno VARCHAR(45) NOT NULL,
          docno VARCHAR(45) NOT NULL,
          revid INT(11) NOT NULL,
          PRIMARY KEY (id)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "transmittals": `
      CREATE TABLE transmittals (
          docno VARCHAR(45) NOT NULL,
          docname VARCHAR(255) NOT NULL,
          issuedate DATE DEFAULT '0000-00-00',
          returndate DATE DEFAULT '0000-00-00',
          expretdate DATE DEFAULT '0000-00-00',
          complete TINYINT(1) NOT NULL DEFAULT '0',
          cancelled TINYINT(1) NOT NULL DEFAULT '0',
          transmitto VARCHAR(255) DEFAULT NULL,
          herocontact VARCHAR(255) DEFAULT NULL,
          issuedvia VARCHAR(255) DEFAULT NULL,
          approval TINYINT(1) NOT NULL DEFAULT '0',
          closeout TINYINT(1) NOT NULL DEFAULT '0',
          construction TINYINT(1) NOT NULL DEFAULT '0',
          information TINYINT(1) NOT NULL DEFAULT '0',
          quotation TINYINT(1) NOT NULL DEFAULT '0',
          tender TINYINT(1) NOT NULL DEFAULT '0',
          remarks VARCHAR(255) DEFAULT NULL,
          PRIMARY KEY (docno),
          UNIQUE KEY docno_UNIQUE (docno)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
 
    "risk": `
        CREATE TABLE risk (
            riskid INT(11) NOT NULL AUTO_INCREMENT,
            \`desc\` VARCHAR(255) NOT NULL,
            open INT(11) NOT NULL DEFAULT '-1',
            linkid INT(11) DEFAULT NULL,
            PRIMARY KEY (riskid)
        ) ENGINE=InnoDB DEFAULT CHARSET=latin1
    `
  ,
  
  "cons": `
      CREATE TABLE cons (
          consid INT(11) NOT NULL AUTO_INCREMENT,
          riskid INT(11) NOT NULL,
          risktype VARCHAR(45) DEFAULT NULL,
          cons VARCHAR(1) NOT NULL,
          prob INT(11) NOT NULL,
          risklevel INT(11) DEFAULT NULL,
          PRIMARY KEY (consid)
      ) ENGINE=InnoDB DEFAULT CHARSET=latin1
  `,
  "revDistMaxID": `
  CREATE ALGORITHM=UNDEFINED DEFINER='dbserver'@'%' SQL SECURITY DEFINER VIEW revDistMaxID AS
  select distinct revNew.docno AS docno, max(revNew.id) AS id from revNew group by revNew.docno
`,
  "revMax": `
  CREATE ALGORITHM=UNDEFINED DEFINER='dbserver'@'%' SQL SECURITY DEFINER VIEW revMax AS
  select revDistMaxID.docno AS docno, revDistMaxID.id AS id, revNew.rev AS rev, revNew.revdate AS revdate, revNew.revdesc AS revdesc, revNew.schedate AS schedate, revNew.issuedate AS issuedate, revNew.returndate AS returndate, revNew.expretdate AS expretdate
  from (revDistMaxID
  left join revNew on((revDistMaxID.docno = revNew.docno) and (revDistMaxID.id = revNew.id)))
  group by revDistMaxID.docno
`,
  "revSort": `
      CREATE ALGORITHM=UNDEFINED DEFINER='dbserver'@'%' SQL SECURITY DEFINER VIEW revSort AS 
      select revNew.id AS id, revNew.docno AS docno, revNew.rev AS rev, revNew.revdate AS revdate, revNew.revdesc AS revdesc, revNew.schedate AS schedate, revNew.issuedate AS issuedate, revNew.returndate AS returndate, revNew.expretdate AS expretdate,
      if((revNew.schedate <> '0000-00-00'), if((revNew.issuedate <> '0000-00-00'), if((revNew.issuedate > revNew.schedate), -(1), 0), if((curdate() > revNew.schedate), -(1), 0)), 0) AS late,
      if((revNew.expretdate <> '0000-00-00'), if((revNew.returndate <> '0000-00-00'), if((revNew.returndate > revNew.expretdate), -(1), 0), if((curdate() > revNew.expretdate), -(1), 0)), 0) AS overdue 
      from revNew 
      order by revNew.docno, if((ascii(revNew.rev) > ascii('9')), (ascii(revNew.rev) - ascii('A')), ascii(revNew.rev)) desc, revNew.rev desc, revNew.revdate desc
  `
};

const tblinit = {
  "doctype": `
      INSERT INTO doctype VALUES 
      (0,'CAL','Calculation', 0),
      (1,'DWG','Drawing', 0),
      (2,'MOM','Minutes Of Meeting', 0),
      (3,'QA','Quality Assurance', 0),
      (4,'REP','Report', 1),
      (5,'SPC','Specification', 0),
      (6,'TQ','Technical Query', 0),
      (7,'TR','Transmittal', 0),
      (8,'VR','Variation Request', 0),
      (10,'BOM','Bill Of Materials', 0),
      (11,'ITR','Inspection Test Record', 1),
      (12,'ITP','Inspection Test Plan', 1),
      (13,'SKM','SKM Power Tools', 0),
      (14,'RFQ','Request For Quotation', 0),
      (15,'CEM','Cause & Effects Matrix', 1),
      (16,'BOD','Basis Of Design', 0),
      (17,'DS','Datasheet', 0),
      (18,'SRS','Safety Requirement Specification', 1),
      (19,'SW','Software', 1),
      (20,'IOM','Installation Operation Manual', 1),
      (21,'SC','Schedule', 0),
      (22,'DL','Discrepancy List', 0),
      (23,'PL','Punch List', 0),
      (24,'IDX','Index', 0),
      (25,'WP','Workpack', 0),
      (26,'SDS','Supplier Data Schedule', 0),
      (27,'PHL','Philosophy', 1),
      (29,'FSA','Functional Safety Assessment', 1),
      (30,'ICP','Installation and Commissioning Plan', 1),
      (31,'SVP','SIS Validation Plan', 1),
      (32,'PTR','Phase Test Record', 1),
      (33,'SOP','Standard Operation Procedure', 1),
      (34,'DOS','Dossier', 0),
      (35,'RSR','Risk Register', 1),
      (36,'FAT','Factory Acceptance Test', 1),
      (37,'SAT','Site Acceptance Test', 1),
      (38,'PEP','Project Execution Plan', 1),
      (39,'PLN','Plan', 1),
      (40,'SID','SIL Determination', 1),
      (41,'SFS','Safety Functions Specification', 1),
      (42,'OMP','Operation and Maintenance Plan', 1),
      (43,'FDS','Software Design', 1),
      (44,'HDS','Hardware Design', 1),
      (45,'MDR','Manufacturer''s Data Records', 1),
      (46,'MRQ','Modification and Retrofit Plan', 1),
      (47,'DCP','Decommissioning And Disposal Plan', 1),
      (48,'ECR','Engineering Change Request', 0),
      (49,'CHK','Phase Checklist',1),
      (50,'STR','Strategy',0),
      (51,'ICT','Inspection and Commissioning Tasks', 1),
      (52,'SIV','SIL Verification', 1),
      (53,'DD','Delivery Docket',0),
      (54,'ADT','Audit',1),
      (55,'TAN','Technical Advice Notice',1),
      (56,'EST','Estimate',0)
  `,
  "drawingblock": `
      INSERT INTO drawingblock VALUES  
      (0,'0000 - Single Line'),
      (1,'1000 - General Arrangement'),
      (2,'2000 - Network/Segment/Cable Block'),
      (3,'3000 - Termination'),
      (4,'4000 - Schematics'),
      (5,'5000 - Instrument Loop'),
      (6,'6000 - Instrument Hookup'),
      (7,'7000 - P&ID'),
      (8,'8000 - Spare'),
      (9,'9000 - Spare')
  `,
  "drawingtype": `
      INSERT INTO drawingtype VALUES  
      (1,'E','Electrical'),
      (2,'I','Instrumentation')
  `,
  "revisiondef": `
      INSERT INTO revisiondef VALUES  
      (1,'A','Preliminary Design'),
      (2,'B','Internal Review'),
      (3,'C','Client Review'),
      (4,'D','Client Review'),
      (5,'0','Issued For Construction'),
      (6,'1','Asbuilt')
  `,
  "skmtype": `
      INSERT INTO skmtype VALUES  
      (0,'D','Demand Load'),
      (1,'L','Load Flow'),
      (2,'S','Short Circuit'),
      (3,'P','Protection Coordination'),
      (4,'A','Arc Flash Evaluation'),
      (5,'T','Transient Condition Studies'),
      (6,'H','Harmonic Analysis')
  `
};





const createPdConnection = (database) => mysql.createConnection(pdConfig(database));

const createTsConnection = async () => odbc.connect(tsConfig);

module.exports = {
  createPdConnection,
  createTsConnection,
  dbinit,
  tblinit
  
};


