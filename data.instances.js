/* Example instances, one or more for every principle in the model. The first four
   are from the A-Youth IPM1 material, kept as written so they read as the reference.
   The rest are written against this game model as starting points, not club material.
   All editable, and anything you write is saved alongside them. */
window.INSTANCES = [
 {
  "name": "The through ball behind the backline",
  "principle": "IP6",
  "moment": "Attacking Organization",
  "igs": "When we have opportunities to break the opponent's last line, we do not deliver the final pass because of the lack of runs to cue a through pass.",
  "strategy": "Penetrate behind the opposition backline.",
  "source": "A-Youth IPM1",
  "components": [
   {
    "text": "The ball carrier has opportunity to play forward.",
    "filter": "Ball carrier central or in the half-space",
    "missing": "Overload away from the ball to free the carrier"
   },
   {
    "text": "Space is behind the backline for a through ball.",
    "filter": "Backline on or above halfway",
    "missing": "Constrain the defending team to hold a higher line"
   },
   {
    "text": "At least one teammate is ahead of the ball carrier to run onto the through ball.",
    "filter": "Runner starting level with or behind the last defender",
    "missing": "Add a target, or call the run until they see it"
   }
  ]
 },
 {
  "name": "The pass into the space between the lines",
  "principle": "OP14",
  "moment": "Defensive Organization",
  "igs": "When the opponent has the ball in the middle third we allow the pass into the space between our lines and defend facing our own goal.",
  "strategy": "Deny penetration through central areas to force the opponent wide.",
  "source": "A-Youth IPM1",
  "components": [
   {
    "text": "The opponent in possession has opportunity to play forward.",
    "filter": "Opponent facing our goal with the ball settled",
    "missing": "Let the opponent build unopposed until the picture appears"
   },
   {
    "text": "An opponent occupies the central space between our lines.",
    "filter": "A receiver between our midfield and back line",
    "missing": "Add a floating player who must receive centrally"
   },
   {
    "text": "A teammate is positioned between the ball and that opponent.",
    "filter": "Our screening player goal-side of the receiver",
    "missing": "Freeze it and show the screening position"
   }
  ]
 },
 {
  "name": "The first forward pass after the regain",
  "principle": "TR10",
  "moment": "Attacking Transition",
  "igs": "When we regain the ball in the middle third we take a touch backward and the opponent recovers behind the ball before we play forward.",
  "strategy": "Penetrate forward at speed after the regain.",
  "source": "A-Youth IPM1",
  "components": [
   {
    "text": "The player who regains the ball has opportunity to play forward.",
    "filter": "Regain made facing forward or able to turn in one touch",
    "missing": "Condition the regain to happen facing play"
   },
   {
    "text": "Space is ahead of the opponent's recovering players.",
    "filter": "At least one opponent still ahead of the ball",
    "missing": "Start the exercise with opponents committed forward"
   },
   {
    "text": "At least one teammate is ahead of the ball with a path into that space.",
    "filter": "Runner already moving at the moment of the regain",
    "missing": "Name the runner before the regain happens"
   }
  ]
 },
 {
  "name": "The arrival in the box on the delivery",
  "principle": "IP9",
  "moment": "Attacking Organization",
  "igs": "When we deliver from wide areas we arrive with one player in the box and the delivery is cleared.",
  "strategy": "Penetrate the box to attack deliveries from wide areas.",
  "source": "A-Youth IPM1",
  "components": [
   {
    "text": "A teammate is in a position to deliver from a wide area.",
    "filter": "Delivery point level with or beyond the top of the box",
    "missing": "Constrain the attack to finish through a wide zone"
   },
   {
    "text": "More than one attacker is arriving into the box.",
    "filter": "Near post, penalty spot and back post all occupied",
    "missing": "Score only from a second-arriving player"
   },
   {
    "text": "The arrival is timed to the delivery rather than early.",
    "filter": "Runner still moving as the ball is struck",
    "missing": "Delay the delivery cue so early runners are caught"
   }
  ]
 },
 {
  "name": "Receiving on the back foot between the lines",
  "principle": "IP1",
  "moment": "Attacking Organization",
  "igs": "When the ball travels into midfield we receive square and play backward, so the picture in front is never used.",
  "strategy": "Open the body before it arrives.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The receiver is between the opponent's lines when the ball is played.",
    "filter": "At least one opponent ahead and one behind the receiver",
    "missing": "Lock a zone that must be occupied"
   },
   {
    "text": "There is time to check the shoulder before the ball arrives.",
    "filter": "Ball travelling more than ten yards",
    "missing": "Lengthen the pass so the scan is possible"
   },
   {
    "text": "A forward option exists at the moment of receiving.",
    "filter": "A teammate ahead of the receiver and free",
    "missing": "Add a target so forward is always available"
   }
  ]
 },
 {
  "name": "The switch that arrives before the block shifts",
  "principle": "IP5",
  "moment": "Attacking Organization",
  "igs": "When one side is crowded we switch late and the opponent has already slid across.",
  "strategy": "Move the ball faster than the block can move.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The opponent's block is loaded to one side.",
    "filter": "Two-thirds of the defending team on the ball side",
    "missing": "Reward sustained possession on one side first"
   },
   {
    "text": "A free player is available on the far side.",
    "filter": "Far player unmarked and facing the pitch",
    "missing": "Protect the far player with a no-press zone"
   },
   {
    "text": "The switch is played in two passes or fewer.",
    "filter": "Counted from the moment the far player is free",
    "missing": "Limit touches in the central channel"
   }
  ]
 },
 {
  "name": "The moment the press is triggered",
  "principle": "OP13",
  "moment": "Defensive Organization",
  "igs": "When the trigger appears we press in ones and twos rather than together, so the first defender is bypassed.",
  "strategy": "Press as a unit on a shared cue.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The agreed trigger is present.",
    "filter": "A backward pass, a heavy touch, or the ball travelling wide",
    "missing": "Constrain the opponent so the trigger has to occur"
   },
   {
    "text": "The nearest player moves to the ball as the trigger appears.",
    "filter": "Within two seconds of the trigger",
    "missing": "Freeze it and rehearse the first movement"
   },
   {
    "text": "At least one supporting player moves with them.",
    "filter": "Cover behind and inside the first defender",
    "missing": "Number the unit so support is named"
   }
  ]
 },
 {
  "name": "The counter-press in the first five seconds",
  "principle": "TR11",
  "moment": "Defensive Transition",
  "igs": "When we lose it in the attacking half we drop off instead of pressing, and the opponent escapes.",
  "strategy": "Win it back before they are set.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The ball is lost with our players still ahead of it.",
    "filter": "Three or more players ahead of the ball at the moment of loss",
    "missing": "Start the exercise from a settled attacking shape"
   },
   {
    "text": "The opponent's first touch is under pressure or takes them backward.",
    "filter": "Pressure within two seconds",
    "missing": "Reduce the space so the first touch is contested"
   },
   {
    "text": "The nearest players close the two obvious escape passes.",
    "filter": "Forward and wide options both covered",
    "missing": "Name the two passes before the rep starts"
   }
  ]
 },
 {
  "name": "Denying the entry pass into the box",
  "principle": "OP17",
  "moment": "Defensive Organization",
  "igs": "When the opponent reaches the edge of the box we watch the ball and the entry pass goes through us.",
  "strategy": "Deny the seam before it opens.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The opponent has the ball within twenty yards of our box.",
    "filter": "Ball settled and facing our goal",
    "missing": "Build the picture from a wide overload"
   },
   {
    "text": "An opponent is occupying the space our defenders can see and feel.",
    "filter": "A receiver between the back four",
    "missing": "Add a striker who must start between the centre backs"
   },
   {
    "text": "Our nearest defender is able to touch or block the passing line.",
    "filter": "Within a stride of the seam",
    "missing": "Freeze it and mark the seam on the grass"
   }
  ]
 },
 {
  "name": "The third-man combination out of pressure",
  "principle": "IP7",
  "moment": "Attacking Organization",
  "igs": "When we are pressed we play the obvious pass and lose it, because the third player is not seen.",
  "strategy": "Use the player the presser cannot see.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The player on the ball is under pressure from one opponent.",
    "filter": "Presser within two yards",
    "missing": "Guarantee a presser by conditioning the activity"
   },
   {
    "text": "A near option exists that draws the press.",
    "filter": "Available within ten yards",
    "missing": "Fix a bounce player who must be used"
   },
   {
    "text": "A third player is free beyond the press at the moment the first pass is made.",
    "filter": "Free and facing forward",
    "missing": "Freeze it and show where the third player was"
   }
  ]
 },
 {
  "name": "Holding compactness as the ball travels",
  "principle": "OP14",
  "moment": "Defensive Organization",
  "igs": "When the ball travels across the pitch our lines stretch and the space between them opens.",
  "strategy": "Move as the ball moves, not after it arrives.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The ball travels more than fifteen yards across or backward.",
    "filter": "A pass that changes the angle of the block",
    "missing": "Force lateral circulation with a wide rule"
   },
   {
    "text": "The distance between our lines can be seen to change.",
    "filter": "More than twelve yards between midfield and back line",
    "missing": "Mark the corridor so the gap is visible"
   },
   {
    "text": "The far side of our block has ground to make up.",
    "filter": "Far player more than five yards from their position",
    "missing": "Slow the game down and walk the slide"
   }
  ]
 },
 {
  "name": "Regulating the tempo after a regain in our half",
  "principle": "IP8",
  "moment": "Attacking Organization",
  "igs": "When we win it in our own half we play forward immediately into pressure and give it straight back.",
  "strategy": "Secure it, then decide.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The ball is regained in our own half.",
    "filter": "Behind the halfway line",
    "missing": "Condition where the regain is allowed to happen"
   },
   {
    "text": "The forward pass is contested at the moment of the regain.",
    "filter": "No free forward option",
    "missing": "Cover the forward option deliberately"
   },
   {
    "text": "A secure option exists sideways or behind.",
    "filter": "Free and facing the pitch",
    "missing": "Add a keeper or a spare player behind the ball"
   }
  ]
 },
 {
  "name": "The overload that frees the far side",
  "principle": "IP2",
  "moment": "Attacking Organization",
  "igs": "When we build on one side we keep the ball there until it is lost, because nobody makes the far side available.",
  "strategy": "Create space on one side to use the other.",
  "source": "Written for this model",
  "components": [
   {
    "text": "Three or more of ours are within fifteen yards of the ball.",
    "filter": "Counted at the moment the ball settles",
    "missing": "Reward keeping it on one side for three passes"
   },
   {
    "text": "The opponent has shifted to match that overload.",
    "filter": "More defenders ball-side than away from it",
    "missing": "Add a rule that the defending team must press the ball"
   },
   {
    "text": "A teammate on the far side is free and facing the pitch.",
    "filter": "Beyond the width of the block",
    "missing": "Fix a wide player who cannot be marked"
   }
  ]
 },
 {
  "name": "The two against one on the flank",
  "principle": "IP3",
  "moment": "Attacking Organization",
  "igs": "When we get the ball wide we go one against one and lose it, because the second player arrives late.",
  "strategy": "Arrive in twos where they defend in ones.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The ball reaches a wide player facing the opponent.",
    "filter": "In the attacking half",
    "missing": "Condition the entry pass to go wide"
   },
   {
    "text": "One defender is engaged with the ball.",
    "filter": "Within touching distance",
    "missing": "Make the wide duel one against one to start"
   },
   {
    "text": "A second attacker arrives beyond or inside the defender before the first is closed down.",
    "filter": "Arriving, not standing",
    "missing": "Name the supporting runner before the rep"
   }
  ]
 },
 {
  "name": "The disguise that fixes a defender",
  "principle": "IP4",
  "moment": "Attacking Organization",
  "igs": "When we carry the ball forward the defender reads it early and the pass is intercepted.",
  "strategy": "Make them commit before we decide.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The carrier is running at a defender with space to travel.",
    "filter": "At least five yards ahead of the carrier",
    "missing": "Open the space so carrying is possible"
   },
   {
    "text": "Two options exist that the defender must choose between.",
    "filter": "One inside, one outside",
    "missing": "Fix two receivers on either side"
   },
   {
    "text": "The defender commits to one before the ball is released.",
    "filter": "A visible step or turn of the hips",
    "missing": "Freeze at the moment of the step and show it"
   }
  ]
 },
 {
  "name": "Reading the pass before it is played",
  "principle": "OP12",
  "moment": "Defensive Organization",
  "igs": "When the opponent settles we react to the pass instead of the picture, and arrive a stride late.",
  "strategy": "Move on the cue, not the ball.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The opponent on the ball shows a cue we have named.",
    "filter": "Head down, a heavy touch, or hips opening to one side",
    "missing": "Slow the game and rehearse the cue in isolation"
   },
   {
    "text": "The likely receiver is identifiable before the pass.",
    "filter": "One obvious option ahead of the ball",
    "missing": "Reduce the options so the read is possible"
   },
   {
    "text": "Our nearest player moves as the cue appears rather than as the ball travels.",
    "filter": "Movement starting before contact",
    "missing": "Freeze at the cue and ask what they saw"
   }
  ]
 },
 {
  "name": "Forcing the opponent into the trap",
  "principle": "OP15",
  "moment": "Defensive Organization",
  "igs": "When we press we let them choose where to play, so the ball goes where we are weakest.",
  "strategy": "Show them one way and load it.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The first defender approaches from an angle that closes one side.",
    "filter": "Body shape shutting the inside or the outside",
    "missing": "Rehearse the approach angle unopposed"
   },
   {
    "text": "The side we are showing them to is loaded.",
    "filter": "Two of ours within ten yards of the intended receiver",
    "missing": "Number the trapping unit before the rep"
   },
   {
    "text": "The opponent plays into that side.",
    "filter": "Within two passes of the first press",
    "missing": "Constrain the opponent so the other side is unavailable"
   }
  ]
 },
 {
  "name": "Filling the space in front of goal",
  "principle": "OP16",
  "moment": "Defensive Organization",
  "igs": "When the ball reaches the byline we all watch it and the cut-back is unmarked.",
  "strategy": "Defend the pull-back before the cross.",
  "source": "Written for this model",
  "components": [
   {
    "text": "The opponent has the ball wide and level with our box.",
    "filter": "Beyond the width of the penalty area",
    "missing": "Build the picture from a wide overload"
   },
   {
    "text": "An opponent is arriving at the edge of the box behind the last defender's eye line.",
    "filter": "Between the penalty spot and the D",
    "missing": "Add a late-arriving attacker who must be used"
   },
   {
    "text": "One of ours is goal-side of that arrival as the ball is struck.",
    "filter": "Within a stride and facing the ball",
    "missing": "Freeze it and mark the pull-back line"
   }
  ]
 }
];
