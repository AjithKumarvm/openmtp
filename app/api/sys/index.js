'use strict';

import fs from 'fs';
import Promise from 'bluebird';
import junk from 'junk';
import path from 'path';
import moment from 'moment';
import { log } from '@Log';
import { mtp } from '@Binaries';
import childProcess from 'child_process';
import spawn from 'spawn-promise';
import findLodash from 'lodash/find';
import { deviceTypeConst } from '../../constants';

const readdir = Promise.promisify(fs.readdir);
const exec = Promise.promisify(childProcess.exec);

export const promisifiedSpawn = cmd => {
  return spawn(...cmd)
    .then(res => {
      return {
        data: res.toString(),
        error: null
      };
    })
    .catch(e => {
      return {
        data: null,
        error: e.toString()
      };
    });
};

const promisifiedExec = command => {
  try {
    return new Promise(function(resolve, reject) {
      exec(command, (error, stdout, stderr) =>
        resolve({
          data: stdout,
          stderr: stderr,
          error: error
        })
      );
    });
  } catch (e) {
    log.error(e);
  }
};

const promisifiedExecNoCatch = command => {
  return new Promise(function(resolve, reject) {
    exec(command, (error, stdout, stderr) =>
      resolve({
        data: stdout,
        stderr: stderr,
        error: error
      })
    );
  });
};

const checkMtpFileExists = async filePath => {
  const escapedFilePath = `${escapeShell(filePath)}`;

  const { data, error, stderr } = await promisifiedExecNoCatch(
    `${mtp} "properties \\"${escapedFilePath}\\""`
  );

  return data && data.toString().trim() !== '';
};

export const checkFileExists = async (filePath, deviceType) => {
  let fullPath = path.resolve(filePath);
  switch (deviceType) {
    case deviceTypeConst.local:
      return await fs.existsSync(fullPath);
      break;
    case deviceTypeConst.mtp:
      return await checkMtpFileExists(fullPath);
      break;
    default:
      break;
  }

  return true;
};

/**
  Local device ->
 */
export const asyncReadLocalDir = async ({ filePath, ignoreHidden }) => {
  try {
    let response = [];
    const { error, data } = await readdir(filePath, 'utf8')
      .then(res => {
        return {
          data: res,
          error: null
        };
      })
      .catch(e => {
        return {
          data: null,
          error: e
        };
      });

    if (error) {
      log.error(error, `asyncReadLocalDir`);
      return { error: true, data: null };
    }

    let files = data;

    files = data.filter(junk.not);
    if (ignoreHidden) {
      files = data.filter(item => !/(^|\/)\.[^\/\.]/g.test(item));
    }

    for (let file of files) {
      let fullPath = path.resolve(filePath, file);

      if (!fs.existsSync(fullPath)) {
        continue;
      }
      const stat = fs.statSync(fullPath);
      const isFolder = fs.lstatSync(fullPath).isDirectory();
      const extension = path.extname(fullPath);
      const size = stat.size;
      const dateTime = stat.atime;

      if (findLodash(response, { path: fullPath })) {
        continue;
      }

      response.push({
        name: file,
        path: fullPath,
        extension: extension,
        size: size,
        isFolder: isFolder,
        dateAdded: moment(dateTime).format('YYYY-MM-DD HH:mm:ss')
      });
    }
    return { error, data: response };
  } catch (e) {
    log.error(e);
  }
};

export const delLocalFiles = async ({ fileList }) => {
  try {
    if (!fileList || fileList.length < 1) {
      return { error: `No files selected.`, stderr: null, data: null };
    }

    const escapedCmd = fileList
      .map(a => {
        return `"${escapeShell(a)}"`;
      })
      .join(' ');

    const { data, error, stderr } = await promisifiedExec(
      `rm -rf ${escapedCmd}`
    );

    if (error || stderr) {
      log.error(`${error} : ${stderr}`, `delLocalFiles -> rm error`);
      return { error, stderr, data: false };
    }

    return { error: null, stderr: null, data: true };
  } catch (e) {
    log.error(e);
  }
};

export const renameLocalFiles = async ({ oldFilePath, newFilePath }) => {
  try {
    if (
      typeof oldFilePath === 'undefined' ||
      oldFilePath === null ||
      typeof newFilePath === 'undefined' ||
      newFilePath === null
    ) {
      return { error: `No files selected.`, stderr: null, data: null };
    }

    const escapedOldFilePath = `"${escapeShell(oldFilePath)}"`;
    const escapedNewFilePath = `"${escapeShell(newFilePath)}"`;

    const { data, error, stderr } = await promisifiedExec(
      `mv ${escapedOldFilePath} ${escapedNewFilePath}`
    );

    if (error || stderr) {
      log.error(`${error} : ${stderr}`, `renameLocalFiles -> mv error`);
      return { error, stderr, data: false };
    }

    return { error: null, stderr: null, data: true };
  } catch (e) {
    log.error(e);
  }
};

export const newLocalFolder = async ({ newFolderPath }) => {
  try {
    if (typeof newFolderPath === 'undefined' || newFolderPath === null) {
      return { error: `No files selected.`, stderr: null, data: null };
    }

    const escapedNewFolderPath = `"${escapeShell(newFolderPath)}"`;

    const { data, error, stderr } = await promisifiedExec(
      `mkdir -p ${escapedNewFolderPath}`
    );

    if (error || stderr) {
      log.error(`${error} : ${stderr}`, `newLocalFolder -> mkdir error`);
      return { error, stderr, data: false };
    }

    return { error: null, stderr: null, data: true };
  } catch (e) {
    log.error(e);
  }
};

/**
 MTP device ->
 */
export const fetchMtpStorageOptions = async () => {
  try {
    const { data, error, stderr } = await promisifiedExec(
      `${mtp} "storage-list"`
    );

    if (error || stderr) {
      log.error(
        `${error} : ${stderr}`,
        `fetchMtpStorageOptions -> storage-list error`
      );
      return { error, stderr, data: null };
    }

    const _storageList = data.split(/(\r?\n)/g);

    let descMatchPattern = /description:(.*)/i;
    let storageIdMatchPattern = /([^\D]+)/;

    let storageList = {};
    _storageList
      .filter(a => {
        return !(a === '\n' || a === '\r\n' || a === '');
      })
      .map((a, index) => {
        if (!a) {
          return null;
        }
        const _matchDesc = descMatchPattern.exec(a);
        const _matchedStorageId = storageIdMatchPattern.exec(a);

        if (
          typeof _matchDesc === 'undefined' ||
          _matchDesc === null ||
          typeof _matchDesc[1] === 'undefined' ||
          typeof _matchedStorageId === 'undefined' ||
          _matchedStorageId === null ||
          typeof _matchedStorageId[1] === 'undefined'
        ) {
          return null;
        }

        const matchDesc = _matchDesc[1].trim();
        const matchedStorageId = _matchedStorageId[1].trim();
        storageList = {
          ...storageList,
          [matchedStorageId]: {
            name: matchDesc,
            selected: index === 0
          }
        };
      });

    if (
      typeof storageList === 'undefined' ||
      storageList === null ||
      storageList.length < 1
    ) {
      return { error: `MTP storage not accessible`, stderr: null, data: null };
    }

    return { error: null, stderr: null, data: storageList };
  } catch (e) {
    log.error(e);
  }
};

export const asyncReadMtpDir = async ({ filePath, ignoreHidden }) => {
  try {
    const mtpCmdChop = {
      type: 2,
      dateAdded: 4,
      timeAdded: 5,
      name: 6
    };
    let response = [];

    const {
      data: fileListData,
      error: fileListError,
      stderr: fileListStderr
    } = await promisifiedExec(`${mtp} "ls \\"${escapeShell(filePath)}\\""`);

    const {
      data: filePropsData,
      error: filePropsError,
      stderr: filePropsStderr
    } = await promisifiedExec(
      `${mtp} "lsext \\"${escapeShell(filePath)}\\"" | tr -s " "`
    );

    if (fileListError || fileListStderr) {
      log.error(
        `${fileListError} : ${fileListStderr}`,
        `asyncReadMtpDir -> ls error`
      );
      return { error: fileListError, stderr: fileListStderr, data: null };
    }

    if (filePropsError || filePropsStderr) {
      log.error(
        `${filePropsError} : ${filePropsStderr}`,
        `asyncReadMtpDir -> lsext error`
      );
      return { error: filePropsError, stderr: filePropsStderr, data: null };
    }

    let fileList = fileListData.split(/(\r?\n)/g);
    let fileProps = filePropsData.split(/(\r?\n)/g);

    fileList = fileList
      .filter(a => {
        return !(a === '\n' || a === '\r\n' || a === '');
      })
      .map(a => {
        return a.replace(/(^|\.\s+)\d+\s+/, '');
      });

    fileProps = fileProps.filter(a => {
      return !(a === '\n' || a === '\r\n' || a === '');
    });

    if (fileList.length > fileProps.length) {
      fileList.shift();
    }

    for (let i = 0; i < fileProps.length; i++) {
      let filePropsList = fileProps[i].split(' ');
      if (typeof filePropsList[mtpCmdChop.name] === 'undefined') {
        continue;
      }
      const fileName = fileList[i];

      if (ignoreHidden && /(^|\/)\.[^\/\.]/g.test(fileName)) {
        continue;
      }

      let fullPath = path.resolve(filePath, fileName);
      let isFolder = filePropsList[mtpCmdChop.type] === '3001';
      let dateTime = `${filePropsList[mtpCmdChop.dateAdded]} ${
        filePropsList[mtpCmdChop.timeAdded]
      }`;

      //avoid duplicate values
      if (findLodash(response, { path: fullPath })) {
        continue;
      }
      response.push({
        name: fileName,
        path: fullPath,
        extension: fetchExtension(filePath, isFolder),
        size: null,
        isFolder: isFolder,
        dateAdded: moment(dateTime).format('YYYY-MM-DD HH:mm:ss')
      });
    }

    return { error: null, stderr: null, data: response };
  } catch (e) {
    log.error(e);
  }
};

export const delMtpFiles = async ({ fileList }) => {
  try {
    if (!fileList || fileList.length < 1) {
      return { error: `No files selected.`, stderr: null, data: null };
    }

    for (let i in fileList) {
      const { data, error, stderr } = await promisifiedExec(
        `${mtp} "rm \\"${escapeShell(fileList[i])}\\""`
      );

      if (error || stderr) {
        log.error(`${error} : ${stderr}`, `delMtpDir -> rm error`);
        return { error, stderr, data: false };
      }
    }

    return { error: null, stderr: null, data: true };
  } catch (e) {
    log.error(e);
  }
};

export const newMtpFolder = async ({ newFolderPath }) => {
  try {
    if (typeof newFolderPath === 'undefined' || newFolderPath === null) {
      return { error: `No files selected.`, stderr: null, data: null };
    }

    const escapedNewFolderPath = `${escapeShell(newFolderPath)}`;
    const { data, error, stderr } = await promisifiedExec(
      `${mtp} "mkpath \\"${escapedNewFolderPath}\\""`
    );

    if (error || stderr) {
      log.error(`${error} : ${stderr}`, `newMtpFolder -> mkpath error`);
      return { error, stderr, data: false };
    }

    return { error: null, stderr: null, data: true };
  } catch (e) {
    log.error(e);
  }
};

const fetchExtension = (fileName, isFolder) => {
  if (isFolder) {
    return null;
  }
  return fileName.indexOf('.') === -1
    ? null
    : fileName.substring(fileName.lastIndexOf('.') + 1);
};

const escapeShell = cmd => {
  return cmd.replace(/"/g, '\\"');
};
