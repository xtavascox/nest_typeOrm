import { v4 as uudi } from "uuid";

export const fileNamer = (req: Express.Request, file: Express.Multer.File, callback: Function) => {

  if (!file) return callback(new Error("File is Empty"), false);

  const fileExtension = file.mimetype.split("/")[1];
  const fileName = `${uudi()}.${fileExtension}`;

  callback(null, fileName);

};