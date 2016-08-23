// ==UserScript==
// @name         Oodi2ics
// @namespace    http://tonipes.net/
// @version      0.1
// @description  Export events from oodi to ics files
// @author       Toni Pesola
// @require      https://cdnjs.cloudflare.com/ajax/libs/babel-core/5.6.15/browser-polyfill.min.js
// @require      https://cdnjs.cloudflare.com/ajax/libs/babel-core/5.6.15/browser.min.js
// @require      http://momentjs.com/downloads/moment.min.js
// @require      https://raw.githubusercontent.com/nwcell/ics.js/master/ics.deps.min.js
// @require      https://raw.githubusercontent.com/tonipes/ics.js/master/ics.js
// @require      https://code.jquery.com/jquery-3.1.0.min.js
// @match        https://oodi.aalto.fi/a/opettaptied.jsp*
// ==/UserScript==

/* jshint ignore:start */
var inline_src = (<><![CDATA[
    /* jshint ignore:end */
    /* jshint esnext: true */
    var xpaths = {
      "event_name": (e) => '//*[@id="' + e + '"]/td[2]/table/tbody/tr/td[1]',
      "event_times": (e) => '//*[@id="' + e + '"]/td[2]/table/tbody/tr/td[3]/table/tbody/tr/td',
      "event_person": (e) => '//*[@id="' + e + '"]/td[2]/table/tbody/tr/td[2]/a',
      "event_info": (e) => '//*[@id="' + e + '"]/td[2]/table/tbody/tr[3]/td',
      "event_header": (e) => '//*[@id="' + e + '"]/td[1]',
      "event_location": (e) => '//*[@id="' + e + '"]/td[2]/table/tbody/tr/td[3]/table/tbody/tr/td/input[contains(@type, "SUBMIT")]',
    };

    var global_xpaths = {
      "course_name": '/html/body/table[3]/tbody/tr/td/table/tbody/tr[2]/td[2]',
      "course_code": '/html/body/table[3]/tbody/tr/td/table/tbody/tr[1]/td[2]',
      "course_header": '/html/body/div[2]',
      "course_time": '/html/body/table[3]/tbody/tr/td/table/tbody/tr[5]/td[2]',
      "course_unit": '/html/body/table[3]/tbody/tr/td/table/tbody/tr[3]/td[4]'
    };

    // Site needs to be in finnish, sorry
    var weekdays = ['ma', 'ti','ke','to','pe','la','su'];

    var timetables = document.body.getElementsByClassName("kll");

    var counter = 0;
    for (var table of timetables) {
        var trs = getTimerowsFromTable(table); // This is good

        for (var tr of trs) {
            counter += 1;
            tr.setAttribute('id', 'timetable-' + counter);

            var div_node = document.createElement('div');
            div_node.innerHTML = '<button id="' +'timetable-' + counter + '-btn'+ '" type="button">Get iCal</button>';
            div_node.setAttribute('id', 'timetable-' + counter + '-div');

            var event_header = getElementByXpath(xpaths.event_header('timetable-' + counter))[0];
            event_header.appendChild(div_node);

            document.getElementById('timetable-' + counter + '-btn').addEventListener("click", getCalendar, false);
        }
    }

    // document.getElementById("script-button").addEventListener("click", ScriptButton, false);
    function download(filename, text) {
      var element = document.createElement('a');
      element.setAttribute('href', 'data:text/plain;charset=utf-8,' + encodeURIComponent(text));
      element.setAttribute('download', filename);

      element.style.display = 'none';
      document.body.appendChild(element);

      element.click();

      document.body.removeChild(element);
    }

    function getCalendar(event) {
        var id = event.target.id;
        var table_id = id.substr(0, id.length-4);
        var table = document.getElementById(table_id);

        var course_name = getElementByXpath(global_xpaths.course_name)[0].innerText;
        var course_code = getElementByXpath(global_xpaths.course_code)[0].innerText;
        var events = getEvents(course_name, table_id);

        var cal = ics();

        for (var ev of events) {
          // console.log(ev);
          cal.addEvent(ev.subject, ev.desc, ev.loc, ev.begin, ev.end);
        }
        // console.log(cal);
        // console.log(cal.calendar());
        var element_name = getElementByXpath(xpaths.event_name(table_id))[0].innerText;
        download(course_code + "_" + element_name + ".ics", cal.calendar());
    }

    function getEvents(course_code, id){
      console.log("Getting events for id", id);
      var element_name = getElementByXpath(xpaths.event_name(id))[0].innerText;
      var element_times = getElementByXpath(xpaths.event_times(id));

      var events = [];
      for (var timeblock of element_times) {
        var lesson_times = parseTime(timeblock.innerText);
        for (var lesson_time of lesson_times) {
          events.push({
            'begin': lesson_time.begin,
            'end': lesson_time.end,
            'subject': element_name + ': ' + course_code,
            'loc': getLocationString(id),
            'desc': getDescString(id),
           });
        }
      }

      return events;
    }

    function getDescString(id){
      var event_info = getElementByXpath(xpaths.event_info(id))[0];
      var course_header = getElementByXpath(global_xpaths.course_header)[0].innerText;
      var course_unit = getElementByXpath(global_xpaths.course_unit)[0].innerText;
      var course_time = getElementByXpath(global_xpaths.course_time)[0].innerText;
      console.log(event_info, course_header, course_unit, course_time);
      return course_header + ', ' + course_time + ', ' + course_unit;
    }

    function getLocationString(id){
      var locations = getElementByXpath(xpaths.event_location(id));
      locations = locations.map((l) => l.value);
      return locations.join(', ');
    }

    function getTimerowsFromTable(table){
      var a = table.children[0];
      var trs = Array.prototype.slice.call(a.children);
      trs.shift();
      return trs;
    }

    function getElementByXpath(path) {
      var xres = document.evaluate(path, document, null, XPathResult.ORDERED_NODE_ITERATOR_TYPE, null);
      var res = [];
      var elem = xres.iterateNext();
      while (elem) {
        res.push(elem);
        elem = xres.iterateNext();
      }
      return res;
    }

    function parseTime(str){
      var str_clean = str.trim().replace(/\s+/g,'');
      console.log('before',str_clean);
      if(str_clean[6] != '-'){ // like 07.01.16to12.15-14.00, make it 07.01.-07.01.16to12.15-14.00
        str_clean = str_clean.substr(0, 6) + '-' + str_clean.substr(0, str_clean.length-1);
      }
      console.log('after',str_clean);
      var s_date = str_clean.substr(0, 6) + str_clean.substr(13, 2);
      var e_date = str_clean.substr(7, 8);
      var weekday = str_clean.substr(15, 2);

      var s_time = str_clean.substr(17, 5);
      var e_time = str_clean.substr(23, 5);

      var s_hour = parseInt(s_time.substr(0, 2));
      var s_minute = parseInt(s_time.substr(3, 2));

      var e_hour = parseInt(e_time.substr(0, 2));
      var e_minute = parseInt(e_time.substr(3, 2));

      weekday = weekdays.indexOf(weekday);
      s_date = moment(s_date, "DD.MM.YY");
      e_date = moment(e_date, "DD.MM.YY");

      var days = getDaysBetween(weekday, s_date, e_date);
      var lesson_times = [];

      for (var day of days) {
        lesson_times.push({
          'begin': moment(day).set({'hour': s_hour, 'minute': s_minute}).format('YYYY-MM-DD HH:mm:ss'),
          'end': moment(day).set({'hour': e_hour, 'minute': e_minute}).format('YYYY-MM-DD HH:mm:ss'),
        });
      }
      return lesson_times;
    }

    function getDaysBetween(day, start, end) {
      var res = [moment(start)];

      var cday = moment(start);
      while(cday.isBefore(end)){
        cday.add(7, 'days');
        res.push(moment(cday));
      }
      return res;
    }

    /* jshint ignore:start */
]]></>).toString();
                  var c = babel.transform(inline_src);
eval(c.code);
/* jshint ignore:end */

