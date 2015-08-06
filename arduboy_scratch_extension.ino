// Arduboy Scratch 2.0 extension
// created by David Perrenoud, Kreg Hanning 2014-2015

#include <SPI.h>
#include <EEPROM.h>
#include <Arduboy.h>

Arduboy arduboy;

// Status codes sent from Scratch
const int START_MSG = 0xF0;
const int END_MSG   = 0xF7;

const int READ_BUTTONS       = 1;
const int WRITE_TONE         = 2;
const int WRITE_DRAWLINE     = 3;
const int WRITE_CLEARDISPLAY = 4;

void setup() {
  // Set the Serial baud rate to 38400
  Serial.begin(38400);

  arduboy.start();
  arduboy.setFrameRate(60);
  arduboy.display();
}

void loop() {
  // Check if there are bytes on the Serial port
  if (Serial.available() > 0) {

    // Get first available byte
    int incomingByte = Serial.read();

    if (incomingByte == READ_BUTTONS) {
      byte inputMsg[9];
      
      inputMsg[0] = START_MSG;
      inputMsg[1] = arduboy.pressed(LEFT_BUTTON);
      inputMsg[2] = arduboy.pressed(RIGHT_BUTTON);
      inputMsg[3] = arduboy.pressed(UP_BUTTON);
      inputMsg[4] = arduboy.pressed(DOWN_BUTTON);
      inputMsg[5] = arduboy.pressed(A_BUTTON);
      inputMsg[6] = arduboy.pressed(B_BUTTON);
      inputMsg[7] = false; // TODO: start button
      inputMsg[8] = END_MSG;

      // Send message
      for (int i = 0; i < 9; i++) {
        Serial.write(inputMsg[i]);
      }
    } else if (incomingByte == WRITE_TONE) {
      // Next two bytes from Scratch is frequency
      word frequency = word(Serial.read(), Serial.read());

      // Next two bytes from Scratch is duration in ms
      word duration = word(Serial.read(), Serial.read());

      arduboy.tunes.tone(frequency, duration);
    } else if (incomingByte == WRITE_DRAWLINE) {
      // Next bytes from Scratch are coordinates
      byte x0 = Serial.read();
      byte y0 = Serial.read();
      byte x1 = Serial.read();
      byte y1 = Serial.read();

      arduboy.drawLine(x0, y0, x1, y1, WHITE);
      arduboy.display();
    } else if (incomingByte == WRITE_CLEARDISPLAY) {
      arduboy.clearDisplay();
      arduboy.display();
    }
  }

  // Slight delay between loop
  delay(1);
}
