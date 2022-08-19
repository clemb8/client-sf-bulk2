import fs from 'fs';

export async function getFileBody(filename: string) {
  return new Promise((resolve, reject) => {
    fs.readFile(`${filename}`, "utf8", (err, data) => { err ? reject(`Error while parsing the file :${err}`) : resolve(data); });
  });
}