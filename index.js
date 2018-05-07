const Flipdot = require('./flipdot');
const winston = require('winston');

// Set up Winston for logging
winston.remove(winston.transports.Console);
winston.add(winston.transports.Console, {
  level: process.env.LOG_LEVEL,
  prettyPrint: true,
  colorize: true,
  timestamp: true
});

let col = 0;
let fd = new Flipdot('/dev/cu.usbserial-DN03A9ID', 6, 20, 14);

fd.open().then(() => {

  setInterval(() => {

    fd.clear();

    for (let i = 0; i < 14; i ++) {
      fd.setDot(col, i, true);
    }

    fd.send();

    col = col == 20 ? 0 : col + 1;

  }, 1500);

});
