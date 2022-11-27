export const fileFilter = (req: Express.Request, file: Express.Multer.File, callback: Function) => {


  console.log({ file });

  if (!file) return callback(new Error("File is Empty"), false);

  const mimeType = file.mimetype.split("/")[1];

  const validExtension = ["jpg", "jpeg", "png", "gif"];

  if (validExtension.includes(mimeType)) return callback(null, true);

  callback(null, false);

};