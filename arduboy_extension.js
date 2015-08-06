(function(ext) {
  var xPosition = 0;
  var yPosition = 0;
  var direction = 0;
  var isPenDown = true;
  
  var START_MSG = 0xF0;
  var END_MSG   = 0xF7;
  
  var READ_BUTTONS       = 1;
  var WRITE_TONE         = 2;
  var WRITE_DRAWLINE     = 3;
  var WRITE_CLEARDISPLAY = 4;

  var parsingMsg = false;
  var msgBytesRead = 0;
  var storedMsg = new Uint8Array(1024);

  var connected = false;
  var device = null;
  var poller = null;
  var rawData = null;
 
  /* TEMPORARY WORKAROUND
     this is needed since the _deviceRemoved method
     is not called when serial devices are unplugged*/
  var sendAttempts = 0;

  var pingCmd = new Uint8Array(1);
  pingCmd[0] = 1;

  var inputVals = { left: 0, right: 0, up: 0, down: 0, A: 0, B: 0, start: 0 };

  function processMsg() {
    inputVals.left  = storedMsg[0];
    inputVals.right = storedMsg[1];
    inputVals.up    = storedMsg[2];
    inputVals.down  = storedMsg[3];
    inputVals.A     = storedMsg[4];
    inputVals.B     = storedMsg[5];
    inputVals.start = storedMsg[6];
  }

  function processInput(data) {
    for (var i = 0; i < data.length; i++) {
      if (parsingMsg) {
        if (data[i] == END_MSG) {
          parsingMsg = false;
          processMsg();
        } else {
          storedMsg[msgBytesRead++] = data[i];
        }
      } else {
        if (data[i] == START_MSG) {
          parsingMsg = true;
          msgBytesRead = 0;
        }
      }
    }
  }
  
  function toRadians(angle) {
    return angle * (Math.PI / 180);
  }

  ext.isButtonPressed = function(pin) {
    if (inputVals[pin] > 0) return true;
    return false;
  };

  ext.whenButton = function(pin, val) {
    if (val === 'on')
      return ext.isButtonPressed(pin);
    else
      return ext.isButtonPressed(pin) === false;
  };
  
  ext.tone = function(frequency, duration) {
    duration *= 1000;
    
    var output = new Uint8Array(5);
    output[0] = WRITE_TONE;
    output[1] = frequency & 0xFF;
    output[2] = frequency >> 8;
    output[3] = duration & 0xFF;
    output[4] = duration >> 8;
    device.send(output.buffer);
  };
  
  ext.forward = function(pixels) {
    var oldXPosition = xPosition;
    var oldYPosition = yPosition;
    
    xPosition += pixels * Math.sin(toRadians(direction));
    yPosition += pixels * Math.cos(toRadians(direction));
    
    if (xPosition < -63) {
      xPosition = -63;
    } else if (xPosition > 64) {
      xPosition = 64;
    }
    
    if (yPosition < -31) {
      yPosition = -31;
    } else if (yPosition > 32) {
      yPosition = 32;
    }
    
    if (isPenDown) {
      ext.drawLine(Math.round(oldXPosition) + 63, 32 - Math.round(oldYPosition), Math.round(xPosition) + 63, 32 - Math.round(yPosition));
    }
  };
  
  ext.backward = function(pixels) {
    ext.forward(-pixels);
  };
  
  ext.turnLeft = function(angle) {
    direction -= angle;
  };
  
  ext.turnRight = function(angle) {
    direction += angle;
  };
  
  ext.pointTo = function(angle) {
    direction = angle;
  };
  
  ext.goTo = function(x, y) {
    xPosition = x;
    yPosition = y;
  };
  
  ext.xPosition = function() {
    return xPosition;
  };
  
  ext.yPosition = function() {
    return yPosition;
  };
  
  ext.direction = function() {
    return direction;
  };
  
  ext.clearDisplay = function() {
    var output = new Uint8Array(1);
    output[0] = WRITE_CLEARDISPLAY;
    device.send(output.buffer);
  };
  
  ext.penDown = function() {
    isPenDown = true;
  };
  
  ext.penUp = function() {
    isPenDown = false;
  };
  
  ext.drawLine = function(x0, y0, x1, y1) {
    var output = new Uint8Array(5);
    output[0] = WRITE_DRAWLINE;
    output[1] = x0;
    output[2] = y0;
    output[3] = x1;
    output[4] = y1;
    device.send(output.buffer);
  };
 
  ext._getStatus = function() {
    if (!connected)
      return { status:1, msg:'Disconnected' };
    else
      return { status:2, msg:'Connected' };
  };

  ext._deviceRemoved = function(dev) {
    // Not currently implemented with serial devices
  };

  var poller = null;
  ext._deviceConnected = function(dev) {
    sendAttempts = 0;
    connected = true;
    if (device) return;
    
    device = dev;
    device.open({ stopBits: 0, bitRate: 38400, ctsFlowControl: 0 });
    device.set_receive_handler(function(data) {
      sendAttempts = 0;
      var inputData = new Uint8Array(data);
      processInput(inputData);
    }); 

    poller = setInterval(function() {

      /* TEMPORARY WORKAROUND
         Since _deviceRemoved is not
         called while using serial devices */
      if (sendAttempts >= 10) {
        connected = false;
        device.close();
        device = null;
        rawData = null;
        clearInterval(poller);
        return;
      }
      
      device.send(pingCmd.buffer); 
      sendAttempts++;

    }, 50);
    
    ext.clearDisplay();
  };

  ext._shutdown = function() {
    ext.tone(0, 0.001);
    if (device) device.close();
    if (poller) clearInterval(poller);
    device = null;
  };

  var descriptor = {
    blocks: [
      ['h', 'when %m.buttons is %m.btnStates', 'whenButton', 'left', 'pressed'],
      ['b', '%m.buttons pressed?', 'isButtonPressed', 'left'],
      [' ', 'play frequency %n for %n secs', 'tone', 300, 1],
      ['-'],
      [' ', 'forward %n pixels', 'forward', 5],
      [' ', 'backward %n pixels', 'backward', 5],
      [' ', 'turn left %n degrees', 'turnLeft', 45],
      [' ', 'turn right %n degrees', 'turnRight', 45],
      [' ', 'point in direction %n', 'pointTo', 90],
      [' ', 'go to x: %n y: %n', 'goTo', 0, 0],
      ['r', 'x position', 'xPosition'],
      ['r', 'y position', 'yPosition'],
      ['r', 'direction', 'direction'],
//      ['-'],
//      [' ', 'show', ''],
//      [' ', 'hide', ''],
      ['-'],
      [' ', 'clear screen', 'clearDisplay'],
      [' ', 'pen down', 'penDown'],
      [' ', 'pen up', 'penUp'],
    ],
    menus: {
      buttons: ['left', 'right', 'up', 'down', 'A', 'B', 'start'],
      btnStates: ['pressed', 'released'],
    },  
    url: 'http://khanning.github.io/scratch-littlebits-extension'
  };

  ScratchExtensions.register('Arduboy', descriptor, ext, {type:'serial'});
})({});
