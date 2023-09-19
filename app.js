const path = require("path")
const fs = require("fs")
const filesPath = "./uploads"
const dotenv = require("dotenv")
const { PDFNet} = require("@pdftron/pdfnet-node");
dotenv.config({path: "./config.env"})
const session = require("express-session");
const flash = require("connect-flash");
const expressLayouts = require("express-ejs-layouts");
let filename;
let convertedName;
const mimeType = require("./modules/mimeType");
const express = require("express")


// multer setup to upload files to the server
const multer =  require("multer")
const storage = multer.diskStorage({
    destination: (req, file , cb) =>{
        cb(null, "uploads")
    }, 
    filename: (req, file , cb)=>{
        const { originalname } = file
        cb(null,originalname); 
    }
})
const upload = multer({ storage });


// Initializing the app
const app =  express()


// setting up the view engine
app.use(expressLayouts);
app.set("view engine", "ejs");

// static files
app.use('/public', express.static('public'));


// body parser
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// setting up connect flash and express session
app.use(session({
  secret: 'somesecretkeyforsession',
  saveUninitialized: true,
  resave: true
}));

app.use(flash());

app.use(function(req, res, next) {
  res.locals.error_msg_posts = req.flash('error_msg_posts');
  res.locals.error_msg = req.flash('error_msg');
  next();
});

// home page  
app.get("/", (req,res)=>{
    res.render("index.ejs");
})


// route to upload the files to the server
app.post("/upload", upload.single("upfile"), (req,res)=>{
    // console.log(req.file);
    if(!req.file) {
    req.flash("error_msg", "Please upload a File first");
    res.redirect("/");
    }
    else {
      filename = req.file.originalname;
      res.redirect("functionality");
    }
})


// route to the functionalities page
app.get("/functionality", (req, res) => {
  res.render("functionality");
})


// Converting the file format into the pdf format
app.get('/convert', (req, res) => {
    let ext = filename.split(".")[1];
    ext = "." + ext;

    const fname = filename.split(".")[0];
    convertedName = `${fname}.pdf`;
    const inputPath = path.resolve(__dirname, filesPath, filename);
    const outputPath = path.resolve(__dirname, filesPath, `${fname}.pdf`);
  
    if (ext === '.pdf') {
      // res.statusCode = 500;
      req.flash("error_msg", "File is already PDF.");
      res.redirect("/functionality");
    }
  
    const main = async () => {
      await PDFNet.initialize();
      try {
        const pdfdoc = await PDFNet.PDFDoc.create();
        await pdfdoc.initSecurityHandler();
        await PDFNet.Convert.toPdf(pdfdoc, inputPath);
        pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
      } catch(err) {
        console.error(err);
      }
    };
    PDFNetEndpoint(main, outputPath, res);
  });

// optimize the file size of the pdf
app.get('/optimize',(req,res) => {
    let ext = filename.split(".")[1];
    ext = "." + ext;
    convertedName = `optimized_${filename}`;
    const inputPath = path.resolve(__dirname, filesPath, filename);
    const outputPath = path.resolve(__dirname, filesPath, `optimized_${filename}`);

    if(ext !== ".pdf") {
      res.statusCode = 500;
      req.flash("error_msg", "Only PDFs can be optimized");
      res.redirect("/functionality");
    }
    const main = async () => {
      await PDFNet.initialize();
      try {
        const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
        await pdfdoc.initSecurityHandler();
        await PDFNet.Optimizer.optimize(pdfdoc);
        pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
      } catch(err) {
        console.error(err);
      }
    }
    PDFNetEndpoint(main, outputPath, res);
})

// removing a specified page from the uploaded pdf
app.post('/remove', (req, res) => {
  let ext = filename.split(".")[1];
    ext = "." + ext;
  // console.log(filename);
  convertedName = `removed_${filename}`;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  const outputPath = path.resolve(__dirname, filesPath, `removed_${filename}`);

  if(ext !== ".pdf") {
      res.statusCode = 500;
      req.flash("error_msg_posts", "Pages can be removed only from PDFs");
      res.redirect("/functionality");
  }

    async function main() {
      await PDFNet.initialize();
      try {
        const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
        doc.initSecurityHandler();
        await doc.pageRemove(await doc.getPageIterator(5));
        console.log(doc);
        doc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
      } catch(err) {
        console.error(err);
      }
      
    }
  PDFNetEndpoint(main, outputPath, res);
})



// creating thumbnail from the pdf
app.get('/thumbnail', (req,res) =>{
  let ext = filename.split(".")[1];
  ext = "." + ext;

  let fname = filename.split(".")[0];
  convertedName = `${fname}.png`;
  const inputPath = path.resolve(__dirname, filesPath, filename);
  // console.log(inputPath);
  const outputPath = path.resolve(__dirname, filesPath, `${fname}.png`);


  if (ext !== '.pdf') {
    res.statusCode = 500;
    req.flash("error_msg", `Cannot return a thumbnail with extension: ${ext}.`);
    res.redirect("/functionality");
  }

  const main = async () => {
    await PDFNet.initialize();
    try {
      const doc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
      await doc.initSecurityHandler();
      const pdfdraw = await PDFNet.PDFDraw.create(92);
      const currPage = await doc.getPage(1);
      await pdfdraw.export(currPage, outputPath, 'PNG');
    } catch(err) {
      console.error(err);
    }
    
};

PDFNetEndpoint(main, outputPath, res);
});
  

// Extracting the text of a page from the pdf
app.post('/textExtract', (req, res) => {
  let ext = filename.split(".")[1];
    ext = "." + ext;
    const pageNumber = req.body.pageno;
    // console.log(filename, pageNumber);
    convertedName = `${filename}-${pageNumber}.txt`;

    const inputPath = path.resolve(__dirname, filesPath, filename);

    const outputPath = path.resolve(__dirname, filesPath,`${filename}-${pageNumber}.txt`,
  );

  if (ext !== '.pdf') {
      res.statusCode = 500;
      req.flash("error_msg_posts", "Text can be extracted only from PDF files");
      res.redirect("/functionality");
  }

  const main = async () => {
    await PDFNet.initialize();
    try {
      const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
      await pdfdoc.initSecurityHandler();
      const page = await pdfdoc.getPage(Number(pageNumber));

      if (!page) {
        throw 'Page number is invalid.';
      }

      const txt = await PDFNet.TextExtractor.create();
      const rect = new PDFNet.Rect(0, 0, 612, 794);
      txt.begin(page, rect);
      let text;

      text = await txt.getAsText();
      fs.writeFile(outputPath, text, err => {
        if (err) return console.log(err);
      });
    } catch (err) {
      throw err;
    }
  };

  PDFNetEndpoint(main, outputPath, res);

})


// watermarking the pdf with a custom watermark
app.post("/watermark", (req, res) => {
      let ext = filename.split(".")[1];
      ext = "." + ext;
    // console.log(filename);
    convertedName = `watermarked_${filename}`;
    const inputPath = path.resolve(__dirname, filesPath, filename);
    const outputPath = path.resolve(__dirname,filesPath,`watermarked_${filename}`,);

    // console.log(inputPath);
    // console.log(outputPath);

    if (ext !== '.pdf') {
        res.statusCode = 500;
        req.flash("error_msg_posts", `Only PDF Files can be watermarked`);
        res.redirect("/functionality");
    }

    const main = async () => {
      await PDFNet.initialize();
      try {
        const pdfdoc = await PDFNet.PDFDoc.createFromFilePath(inputPath);
        await pdfdoc.initSecurityHandler();
      
        const stamper = await PDFNet.Stamper.create(
        PDFNet.Stamper.SizeType.e_relative_scale,
        0.5,
        0.5
      );
      stamper.setAlignment(
        PDFNet.Stamper.HorizontalAlignment.e_horizontal_center,
        PDFNet.Stamper.VerticalAlignment.e_vertical_center
      );
      
      const redColorPt = await PDFNet.ColorPt.init(1, 0, 0);
      stamper.setFontColor(redColorPt);
      const pgSet = await PDFNet.PageSet.createRange(
        1,
        await pdfdoc.getPageCount()
      );
      await stamper.stampText(pdfdoc, req.body.watermark, pgSet);
      await pdfdoc.save(outputPath, PDFNet.SDFDoc.SaveOptions.e_linearized);
      } catch(err) {
        console.error(err);
      }
    }
    PDFNetEndpoint(main, outputPath, res);
})

// download the file generated and delete both the files in server
app.get('/download', (req,res) =>{
  //This will be used to download the converted file
  res.download(__dirname +`/uploads/${convertedName}`,`${convertedName}`,(err) =>{
    if(err){
      res.send(err);
    }else{
      //Delete the files from uploads directory after the use
      console.log('Files deleted');
      const delete_path_doc = process.cwd() + `/uploads/${filename}`;
      const delete_path_pdf = process.cwd() + `/uploads/${convertedName}`;
      try {
        fs.unlinkSync(delete_path_doc)
        fs.unlinkSync(delete_path_pdf)
        //file removed
      } catch(err) {
      console.error(err)
      }
    }
  })
})


  // function to handle the after operation of pdf
  const PDFNetEndpoint = (main, pathname, res) => {
    PDFNet.runWithCleanup(main, process.env.PDFTRONKEY)
      .then(() => {
        res.render("download");
      })
      .catch(error => {
        console.log(error);
      });
  };


// defining the port of the server
const PORT = process.env.PORT || 5000


// listening from the server at the port 
app.listen(PORT,() =>{
    console.log(`server started at ${PORT}`)
})


