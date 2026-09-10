import fs from "fs";

export async function getFileBody(filename: string): Promise<string> {
  return new Promise<string>((resolve, reject) => {
    fs.readFile(`${filename}`, "utf8", (err, data) => {
      if (err) { reject(new Error(`Error while parsing the file :${err}`)); } else { resolve(data); }
    });
  });
}
