/* Role responsibilities per position per moment, read from Alex_Edwards_Game_Model_Development.
   The striker grid runs across a page break in the source, so CF transition rows are inferred
   from the continuation page and are flagged for checking. Everything here is editable. */
window.PROFILES = [
 {
  "code": "GK",
  "name": "Goalkeeper",
  "numbers": "1",
  "moments": {
   "Attacking Organization": [
    "Build play from the back, being the extra supporting player in posession",
    "Distribute ball short, and long, through and over"
   ],
   "Defensive Organization": [
    "Position in relation to where the ball is, and angles to near post",
    "Communicate from behind, step, shift, drop etc"
   ],
   "Attacking Transition": [
    "Distribute ball quickly, to start counter-attacks exploit weaknesses",
    "If ahead, slow down and to create an atatcking shape"
   ],
   "Defensive Transition": [
    "Anticipate transition, sweeping any longer balls behind defensive line",
    "Organize back line, based on the threat i.e., space/players"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "CB",
  "name": "Center Backs",
  "numbers": "4, 5",
  "moments": {
   "Attacking Organization": [
    "Be an option for back passes,and know where the next pass goes immediately",
    "Reset points for attacking build up, choices short/long"
   ],
   "Defensive Organization": [
    "Keep compact (close) preventing through balls with block and interceptions",
    "Know when to drop (no pressure) and step (pressure)"
   ],
   "Attacking Transition": [
    "Play forward, to release pressure, as soon as possible",
    "Hold position, vs. counter/ counter-press"
   ],
   "Defensive Transition": [
    "Immediate recovery, sprint back into position",
    "Delay/slow down attack to allow support to arrive and prevent counter-aattacks"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "OB",
  "name": "Outside / Full Backs",
  "numbers": "2, 3",
  "moments": {
   "Attacking Organization": [
    "Positioning reference to #7/11 either inside or outside",
    "Support #6 inside if #7/11 are outside. Be a wide option if #7/11 are inside"
   ],
   "Defensive Organization": [
    "Press opposition WF, as the ball travels or man-mark if dominating 1v1",
    "Get compact (near CB) when ball is on the opposite side"
   ],
   "Attacking Transition": [
    "Stretch (runs) forward",
    "Change, adapt position, in reference to #7/11",
    "Play direct balls forward when possible into targets"
   ],
   "Defensive Transition": [
    "Recover/Sprint back into position i.e., back to marker and track runners",
    "Slow down attack if nearest player"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "CDM",
  "name": "Holding Midfielder / CDM",
  "numbers": "6",
  "moments": {
   "Attacking Organization": [
    "Dictates tempo, and rhythm of attacks. Looks to attract pressure to open up spaces",
    "Pivot between right, and left side. Key to switches of play"
   ],
   "Defensive Organization": [
    "Protecting space in front, and behind by not getting ahead of the ball",
    "Screening/tracking space/ runs in front of back line"
   ],
   "Attacking Transition": [
    "Secure/keep the ball with a short/closer pass or break out of pressure with the ball",
    "Assess structure when moving forward (balance)"
   ],
   "Defensive Transition": [
    "Intercepting passes, and delays forward movement",
    "Breaks up play, tactical fouls, away from danger areas i.e., deep and middle"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "AM",
  "name": "Attacking Midfielders",
  "numbers": "8, 10",
  "moments": {
   "Attacking Organization": [
    "Positioning to the side, and/ or of opponetns CDM",
    "Position wider, If man marked",
    "Offset, eachother with ball side player closer to support"
   ],
   "Defensive Organization": [
    "Support the press, key to final part of trap central",
    "If press is beaten, drop and cover/screen passing lanes",
    "Drop behind, teammate on opposite side to shadow their positioning"
   ],
   "Attacking Transition": [
    "Find, and play the ball forward into a target (space or player) if opponents style is to press",
    "Secure/keep the ball with a short/closer pass or break out of pressure with the ball"
   ],
   "Defensive Transition": [
    "Nearest player, apply press to ball to delay or force decision",
    "Next player to block passing lanes, encourage back/ sideways passes"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "WF",
  "name": "Wide Midfielders / Wingers",
  "numbers": "7, 11",
  "moments": {
   "Attacking Organization": [
    "Get wide first, come in inside second. Assess opponents",
    "Position ahead of OB to draw out of position (ahead)",
    "Postion to the side to open up runs (behind)"
   ],
   "Defensive Organization": [
    "Position between opposition OB and WF, assess where #9 directs press (side)",
    "Press OB to show inside (trap) or drop and shift to support opposite side",
    "Drop into block if no press"
   ],
   "Attacking Transition": [
    "Stretch (runs) behind when we have a clear opening to play forward",
    "Movement beyond #9 if they check to counter",
    "Show short (to support) if teammate is under pressure"
   ],
   "Defensive Transition": [
    "Nearest player, apply press to ball to delay or force decision",
    "Track runners, i.e., OB",
    "Drop back, and create a block"
   ]
  },
  "source": "Game Model Development",
  "check": false
 },
 {
  "code": "CF",
  "name": "Center Forward / Striker",
  "numbers": "9",
  "moments": {
   "Attacking Organization": [
    "Stay on weak-side of ball and opposite CB",
    "Stretch when space is available behind",
    "Check-to when space is available in front"
   ],
   "Defensive Organization": [
    "Iniciate press, through CB directing play wide (to OB)",
    "Cut the option back to the CB, helping set the trap",
    "Continue movement toward"
   ],
   "Attacking Transition": [
    "Stay on weak-side of ball and opposite CB",
    "Stretch (runs) behind when we have a clear opening to play forward",
    "Check toward (hold-up) play to allow for runs beyond"
   ],
   "Defensive Transition": [
    "Nearest player, apply press to ball to delay or force decision",
    "Cut-off, or limit the switch of play, keeping it to the same side of the ball",
    "Drop back, to support block"
   ]
  },
  "source": "Game Model Development",
  "check": true
 }
];
