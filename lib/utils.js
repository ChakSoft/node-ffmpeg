const exec = require('child_process').exec
const fs = require('fs')

const execAsync = async (commands, settings) => {
  const command = [...commands, '2>&1'].join(' ')
  let timeout = null

  console.log('COMMAND >>', command)

  return await new Promise((resolve, reject) => {
    const process = exec(command, settings, (error, stdout) => {
      if (timeout) {
        clearTimeout(timeout)
      }
      if (error) {
        console.error(error)
        return reject(error)
      }
      return resolve({
        stdout,
      })
    })
    if (settings.timeout > 0) {
      timeout = setTimeout(() => {
        process.kill()
      }, settings.timeout * 1000)
    }
  })
}

const isEmptyObject = (obj) => {
  return Object.keys(obj).length === 0
}

const durationToSeconds = (duration, def = 0) => {
  if (isNaN(duration) && /([0-9]+):([0-9]{2}):([0-9]{2})/.exec(duration)) {
    const [hours, minutes, seconds] = duration.substr(0, 8).split(':')
    return (
      parseInt(hours, 10) * 3600 +
      parseInt(minutes, 10) * 60 +
      parseInt(seconds, 10)
    )
  } else if (!isNaN(duration) && parseInt(duration, 10) === duration) {
    return parseInt(duration, 10)
  }
  return def
}

const gcd = (a, b) => {
  if (b === 0) {
    return a
  }
  return gcd(b, a % b)
}

const mkdirp = (dirpath, mode = 0x0777) => {
  fs.mkdirSync(dirpath, {
    mode,
    recursive : true,
  })
}
const addQuotes = (filename) => {
  // Add quotes
  return `"${filename}"`
}

module.exports = {
  exec : execAsync,
  addQuotes,
  mkdirp,
  durationToSeconds,
  isEmptyObject,
  gcd,
}
