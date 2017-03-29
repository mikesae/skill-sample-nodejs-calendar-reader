var Alexa = require('alexa-sdk');
var ical = require('ical');
var http = require('http');
var utils = require('util');
var moment = require('moment');

var states = {
    SEARCHMODE: '_SEARCHMODE',
    DESCRIPTION: '_DESKMODE'
};
// local variable holding reference to the Alexa SDK object
var alexa;

var APP_ID = "amzn1.ask.skill.cb3698a7-00e6-46ac-a136-16f357e59541";

// URL to get the .ics from
var URL = "https://calendar.google.com/calendar/ical/ia0ttobe2lkaaii29h3lghtobk%40group.calendar.google.com/private-65fc910066b6732f90e05878ec763bc2/basic.ics";

// Skills name
var skillName = "Chef";

// Message when the skill is first called
var welcomeMessage = "You can ask chef whats for dinner. Search for dinner by day, or say help. What would you like? ";

// Message for help intent
var HelpMessage = "Here are some things you can say: What's for dinner? What's for dinner on Friday? What's for dinner tomorrow?  What would you like to know?";

var descriptionStateHelpMessage = "Here are some things you can say: Tell me more about dinner tonight";

// Used when there is no data within a time period
var NoDataMessage = "Sorry there is no dinner planned for then. Would you like to search again?";

// Used to tell user skill is closing
var shutdownMessage = "Ok see you again soon.";

// Message used when only 1 event is found allowing for difference in punctuation
var eventMessage = "%s is being served %s";
var eventOnMessage = "%s is being served on %s";

// More info text
var haveEventsReprompt = "Give me a dinner number to hear more information.";

// Error if a date is out of range
var dateOutOfRange = "Date is out of range please choose another date";

// Error if a event number is out of range
var eventOutOfRange = "Dinner number is out of range please choose another event";

// Used when an event is asked for
var descriptionMessage = "Here's the description ";

// Used when an event is asked for
var killSkillMessage = "Ok, great, see you next time.";

var eventNumberMoreInfoText = "You can say the dinner number for more information.";

// used for title on companion app
var cardTitle = "Chef";

// output for Alexa
var output = "";

// stores event that is found to be in our date range
var relevantEvent = {};

// Adding session handlers
var newSessionHandlers = {
    'LaunchRequest': function () {
        this.handler.state = states.SEARCHMODE;
        this.emit(':ask', skillName + " " + welcomeMessage, welcomeMessage);
    },
    "searchIntent": function () {
        this.handler.state = states.SEARCHMODE;
        this.emitWithState("searchIntent");
    },
    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
};

// Create a new handler with a SEARCH state
var startSearchHandlers = Alexa.CreateStateHandler(states.SEARCHMODE, {
    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.emit(':ask', output, welcomeMessage);
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.RepeatIntent': function () {
        this.emit(':ask', output, HelpMessage);
    },

    'searchIntent': function () {
        // Declare variables
        var eventList = [];
        var slotValue = this.event.request.intent.slots.day.value;
        var date;
        var eventDate;

        slotValue = slotValue ? slotValue.toLowerCase() : 'tonight';

        var parent = this;

        // Using the iCal library I pass the URL of where we want to get the data from.
        ical.fromURL(URL, {}, function (err, data) {
            // Loop through all iCal data found
            for (var k in data) {
                if (data.hasOwnProperty(k)) {
                    var ev = data[k];
                    // Pick out the data relevant to us and create an object to hold it.
                    var eventData = {
                        summary: removeTags(ev.summary),
                        location: removeTags(ev.location),
                        description: removeTags(ev.description),
                        start: ev.start,
                        end: ev.end
                    };
                    // add the newly created object to an array for use later.
                    eventList.push(eventData);
                }
            }
            // Check we have data
            if (eventList.length > 0) {
                // Read slot data and parse out a usable date
                eventDate = getDateFromDaySlot(slotValue);

                if (eventDate) {
                    // initiate a new array, and this time fill it with events that fit between the two dates
                    relevantEvent = getEventOnDate(eventDate, eventList);

                    if (relevantEvent) {
                        // change state to description
                        parent.handler.state = states.DESCRIPTION;

                        // Create output for both Alexa and the content card
                        var cardContent = "";
                        if (slotValue == 'today' || slotValue == 'tomorrow' || slotValue == 'tonight') {
                            output = utils.format(eventMessage, removeTags(relevantEvent.summary), slotValue);
                        } else {
                            output = utils.format(eventOnMessage, removeTags(relevantEvent.summary), slotValue);
                        }
                        alexa.emit(':askWithCard', output, haveEventsReprompt, cardTitle, cardContent);
                    } else {
                        output = NoDataMessage;
                        alexa.emit(':ask', output, output);
                    }
                } else {
                    output = NoDataMessage;
                    alexa.emit(':ask', output, output);
                }
            } else {
                output = NoDataMessage;
                alexa.emit(':ask', output, output);
            }
        })
    },

    'AMAZON.HelpIntent': function () {
        output = HelpMessage;
        this.emit(':ask', output, output);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});

// Create a new handler object for description state
var descriptionHandlers = Alexa.CreateStateHandler(states.DESCRIPTION, {
    'eventIntent': function () {

        var reprompt = " Would you like to hear more details?";

        if (relevantEvent) {
            // use the slot value as an index to retrieve description from our relevant array
            output = descriptionMessage + removeTags(relevantEvent.description);
            output += reprompt;
            this.emit(':askWithCard', output, reprompt, relevantEvent.summary, output);
        } else {
            this.emit(':tell', eventOutOfRange);
        }
    },

    'AMAZON.HelpIntent': function () {
        this.emit(':ask', descriptionStateHelpMessage, descriptionStateHelpMessage);
    },

    'AMAZON.StopIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.CancelIntent': function () {
        this.emit(':tell', killSkillMessage);
    },

    'AMAZON.NoIntent': function () {
        this.emit(':tell', shutdownMessage);
    },

    'AMAZON.YesIntent': function () {
        output = welcomeMessage;
        alexa.emit(':ask', eventNumberMoreInfoText, eventNumberMoreInfoText);
    },

    'SessionEndedRequest': function () {
        this.emit('AMAZON.StopIntent');
    },

    'Unhandled': function () {
        this.emit(':ask', HelpMessage, HelpMessage);
    }
});

// register handlers
exports.handler = function (event, context) {
    alexa = Alexa.handler(event, context);
    alexa.appId = APP_ID;
    alexa.registerHandlers(newSessionHandlers, startSearchHandlers, descriptionHandlers);
    alexa.execute();
};
//======== HELPER FUNCTIONS ==============

// Remove HTML tags from string
function removeTags(str) {
    if (str) {
        return str.replace(/<(?:.|\n)*?>/gm, '');
    }
}

// Given an AMAZON.DATE slot value parse out to usable JavaScript Date object
// Utterances that map to the weekend for a specific week (such as "this weekend") convert to a date indicating the week number and weekend: 2015-W49-WE.
// Utterances that map to a month, but not a specific day (such as "next month", or "December") convert to a date with just the year and month: 2015-12.
// Utterances that map to a year (such as "next year") convert to a date containing just the year: 2016.
// Utterances that map to a decade convert to a date indicating the decade: 201X.
// Utterances that map to a season (such as "next winter") convert to a date with the year and a season indicator: winter: WI, spring: SP, summer: SU, fall: FA)
function getDateFromSlot(rawDate) {
    // try to parse data
    var date = new Date(Date.parse(rawDate));
    var eventDate = {};

    // if could not parse data must be one of the other formats
    if (isNaN(date)) {
        // to find out what type of date this is, we can split it and count how many parts we have see comments above.
        var res = rawDate.split("-");
        // if we have 2 bits that include a 'W' week number
        if (res.length === 2 && res[1].indexOf('W') > -1) {
            dates = getWeekData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // if we have 3 bits, we could either have a valid date (which would have parsed already) or a weekend
        } else if (res.length === 3) {
            dates = getWeekendData(res);
            eventDate["startDate"] = new Date(dates.startDate);
            eventDate["endDate"] = new Date(dates.endDate);
            // anything else would be out of range for this skill
        } else {
            eventDate["error"] = dateOutOfRange;
        }
        // original slot value was parsed correctly
    } else {
        eventDate["startDate"] = new Date(date).setUTCHours(0, 0, 0, 0);
        eventDate["endDate"] = new Date(date).setUTCHours(24, 0, 0, 0);
    }
    return eventDate;
}

var dayMap = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6
};

function getDateFromDaySlot(requestedDayName) {
    var now = moment();
    var currentDay = now.day();
    var requestedDay;
    var result;

    if (dayMap[requestedDayName] !== undefined) {
        requestedDay = dayMap[requestedDayName];
        result = now.add(requestedDay - currentDay, 'd');
    } else {
        switch (requestedDayName) {
            case 'today':
            case 'tonight':
                result = now;
                break;
            case 'tomorrow':
                result = now.add(1, 'd');
                break;
            case 'yesterday':
                result = now.add(-1, 'd');
                break;
        }
    }
    return result.toDate();
}

// Given a week number return the dates for both weekend days
function getWeekendData(res) {
    if (res.length === 3) {
        var saturdayIndex = 5;
        var sundayIndex = 6;
        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, saturdayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return {
            startDate: weekStart,
            endDate: weekEnd
        };
    }
}

// Given a week number return the dates for both the start date and the end date
function getWeekData(res) {
    if (res.length === 2) {

        var mondayIndex = 0;
        var sundayIndex = 6;

        var weekNumber = res[1].substring(1);

        var weekStart = w2date(res[0], weekNumber, mondayIndex);
        var weekEnd = w2date(res[0], weekNumber, sundayIndex);

        return {
            startDate: weekStart,
            endDate: weekEnd
        };
    }
}

// Used to work out the dates given week numbers
var w2date = function (year, wn, dayNb) {
    var day = 86400000;

    var j10 = new Date(year, 0, 10, 12, 0, 0),
        j4 = new Date(year, 0, 4, 12, 0, 0),
        mon1 = j4.getTime() - j10.getDay() * day;
    return new Date(mon1 + ((wn - 1) * 7 + dayNb) * day);
};

function getEventOnDate(date, events) {
    var result = null;

    for (var i = 0; i < events.length; i += 1) {
        if (date >= events[i].start && date <= events[i].end) {
            result = events[i];
            break;
        }
    }
    return result;
}