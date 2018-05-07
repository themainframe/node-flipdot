const SerialPort = require('SerialPort');
const winston = require('winston');
const Q = require('q');

class Flipdot {

  constructor (portPath, address, columns, rows) {

    // Store the serial port reference
    this.portPath = portPath;

    // Rows must always be multiples of 8
    if (rows % 8) {
      rows = rows + (8 - (rows % 8));
    }

    // Store address, row and column counts
    this.address = address;
    this.rows = rows;
    this.columns = columns;

    // Store a matrix to represent the current display state
    // In this array, > 0 is (yellow) and 0 is (black)
    this.matrix = new Array(rows * columns).fill(0);

    // The buffer that contains the display bitmap
    this.buf = Buffer.alloc((rows * columns) / 8)
  }

  /**
   * Open the serial connection with the display.
   * Returns a promise that will be resolved when the display is ready to use.
   */
  open () {

    // Create the serial port context
    let deferred = Q.defer();

    this.sp = new SerialPort(this.portPath, {
      baudRate: 4800,
      autoOpen: false
    });

    this.sp.on('open', () => {
      deferred.resolve();
    });

    this.sp.open();

    // Returns a promise that is resolved when the display is ready to use
    return deferred.promise;
  }

  /**
   * ASCII-encode a value. This means taking the two ASCII byte values that make up
   * the hex representation of the integer value being encoded.
   */
  encode (value) {
    let hexValue = value.toString(16).toUpperCase().padStart(2, '0');
    return [hexValue.charCodeAt(0), hexValue.charCodeAt(1)];
  }

  /**
   * Generate the header.
   */
  getHeader () {
    let encodedLength = this.encode(((this.rows * this.columns) / 8));
    return [0x02, 0x31, this.address + 0x30, encodedLength[0], encodedLength[1]];
  }

  /**
   * Clear the display.
   */
  clear () {
    this.matrix.fill(0);
  }

  /**
   * Fill the display.
   */
  fill () {
    this.matrix.fill(1);
  }

  /**
   * Set a single dot.
   */
  setDot (x, y, state) {
    this.matrix[x * this.rows + (y + 1)] = state ? 1 : 0;
  }

  /**
   * Generate the body for this frame.
   */
  getBody (s) {
    let bodyBytes = [];

    // Write the body data
    // for (let i = 0; i < (this.rows * this.columns) / 8; i ++) {
    //   bodyBytes.push(0x30);
    //   bodyBytes.push(0x30);
    // }

    let bit = 0;
    let currentByte = 0;

    for (let c = 0; c < this.columns; c ++) {
      for (let r = 0; r < this.rows; r ++) {
        currentByte |= ((this.matrix[c * this.rows + r] ? 1 : 0) << bit);
        if (bit == 7) {

          // Encode the current byte and add it to the body
          let encodedByte = this.encode(currentByte);
          bodyBytes.push(encodedByte[0]);
          bodyBytes.push(encodedByte[1]);

          // Work on the next byte
          bit = 0;
          currentByte = 0;
          continue;
        }

        bit ++;
      }
    }

    return bodyBytes;
  }

  /**
   * Send the current frame to the display.
   */
  send (s) {

    let buf = [];

    // Generate the header
    let headerBytes = this.getHeader();

    // Keep track of the CRC sum for this frame
    // Start at 1 because we *remove* the SOT byte but *add* the EOT byte
    let sum = headerBytes.reduce((a, c) => { return a + c; }, 1);

    // Write the header
    buf = buf.concat(headerBytes)

    // Write the body
    let bodyBytes = this.getBody(s);
    buf = buf.concat(bodyBytes)

    // Add the body bytes to the sum
    sum += bodyBytes.reduce((a, c) => { return a + c; }, 0);

    // Calculate the checksum
    sum = sum & 0xff;
    let encodedCrc = this.encode((sum ^ 255) + 1);

    // Write the EOT byte and CRC (footer)
    let footerBytes = [0x03, encodedCrc[0], encodedCrc[1]];
    buf = buf.concat(footerBytes)

    // Write all data out to the SP
    setTimeout(() => { this.sp.write(buf, 'binary'); }, 1000);

    winston.debug('Wrote: ', buf.map((v) => { return v.toString(16).padStart(2, '0'); }));
  }

}

module.exports = Flipdot;
