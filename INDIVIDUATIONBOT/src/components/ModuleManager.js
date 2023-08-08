//ModuleManager.js// 

const { MessageEmbed } = require("discord.js");

class ModuleManager{
    constructor(client, config) {
        this.client = client;
        this.config = config;
    }

    getDaysInCurrentMonth(month) {
        const date = new Date(month);

        return new Date(
            date.getFullYear(),
            date.getMonth() + 1,
            0
        ).getDate();
    }

    getDateMsLfg(date, timezone=null) {
        let aDate = date.slice().split(/ /);
        if(aDate.length === 2) {
            let date1 = aDate[0].slice().split("/");
            let date2 = aDate[1].slice().split(":");
            let hour = 0;
            let tz = null;
            if(timezone !== null) {
                tz = timezone;

                let oneHour = 3600000;

                if(Math.sign(tz) === 1) {
                    hour += (tz * oneHour);
                } else if(Math.sign(tz) === -1) {
                    hour -= (tz * oneHour);
                }
            }

            let dateString = `${date1[2]}-${parseInt(date1[1]) <= 9 ? `0${parseInt(date1[1])}` : (parseInt(date1[1]))}-${date1[0]}T${date2[0]}:${date2[1]}:00${tz === null ? "Z" : parseInt(tz) <= 9 ? `${Math.sign(tz) === 1 ? "+" : "-"}0${Math.abs(parseInt(tz))}:00` : `${Math.sign(tz) === 1 ? "+" : "-"}${Math.abs(parseInt(tz))}:00`}`;

            let finalTimestamp = new Date(dateString).getTime();

            return finalTimestamp / 1000;
        } else {
            return 0;
        }
    }

    getDateMs(date, timezone=null) {
        let aDate = date.slice().split(/ /);
        if(aDate.length === 2) {
            let date1 = aDate[0].slice().split("/");
            let date2 = aDate[1].slice().split(":");
            let hour = 0;
            let tz = null;
            if(timezone !== null) {
                tz = !isNaN(parseInt(timezone.replace("utc ", ""))) ? parseInt(timezone.replace("utc ", "")) : -Math.abs(parseInt(timezone.replace("utc _", "")));
                let oneHour = 3600000;

                if(Math.sign(tz) === 1) {
                    hour += (tz * oneHour);
                } else if(Math.sign(tz) === -1) {
                    hour -= (tz * oneHour);
                }
            }

            let dateString = `${date1[2]}-${parseInt(date1[1]) <= 9 ? `0${parseInt(date1[1])}` : (parseInt(date1[1]))}-${date1[0]}T${date2[0]}:${date2[1]}:00${tz === null ? "Z" : parseInt(tz) <= 9 ? `${Math.sign(tz) === 1 ? "+" : "-"}0${Math.abs(parseInt(tz))}:00` : `${Math.sign(tz) === 1 ? "+" : "-"}${Math.abs(parseInt(tz))}:00`}`;

            let finalTimestamp = new Date(dateString).getTime();


            return finalTimestamp / 1000;
        } else {
            return 0;
        }
    }

    convertHMS(value) {
        const sec = parseInt(value, 10); // convert value to number if it's string
        let hours   = Math.floor(sec / 3600); // get hours
        let minutes = Math.floor((sec - (hours * 3600)) / 60); // get minutes
        let seconds = sec - (hours * 3600) - (minutes * 60); //  get seconds
        // add 0 if value < 10; Example: 2 => 02
        if (hours   < 10) {hours   = "0"+hours;}
        if (minutes < 10) {minutes = "0"+minutes;}
        if (seconds < 10) {seconds = "0"+seconds;}
        return hours+'h'+minutes+'m'+seconds+"s"; // Return is HH : MM : SS
    }

    getTimeMs(time) {
        let format = time.slice().split(":");

        let hours = parseFloat(format[0]) * 3600;
        let minutes = parseFloat(format[1]) * 60;
        let seconds = parseFloat(format[2]);

        return hours+minutes+seconds;
    }

    parseForSql(text) {
        let cText = text;
        for(let i = 0; text.length > i; i++) {
            cText = cText.replace('"', "");
        }
        return cText;
    }

    stringifyForSql(text) {
        let cText = text;
        for(let i = 0; text.length > i; i++) {
            cText = cText.replace('"', "'");
        }
        return cText;
    }

    parseFromSql(text) {
        let cText = text;
        for(let i = 0; text.length > i; i++) {
            cText = cText.replace("'", '"');
        }
        return cText;
    }

    date(time) {
        let date = new Date(parseInt(time));

        let month = (date.getMonth()+1) >= 9 ? (date.getMonth()+1) : "0" + (date.getMonth()+1);
        let day = (date.getDate()) >= 9 ? date.getDate() : "0" + date.getDate();
        let hour = (date.getHours()) >= 9 ? date.getHours() : "0" + date.getHours();
        let minute = (date.getMinutes()) >= 9 ? date.getMinutes() : "0" + date.getMinutes()
        return `${day}/${month}/${date.getFullYear()}`
    }

}

module.exports = {
    ModuleManager
}