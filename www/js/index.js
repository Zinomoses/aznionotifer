document.addEventListener('deviceready', onDeviceReady, false);

async function onDeviceReady() {
    try {
        cordova.plugins.backgroundMode.enable();

        // Set default settings for background mode
        cordova.plugins.backgroundMode.setDefaults({
            title: "Azino is Working",
            text: "Matching Pairs",
            icon: 'icon', // path to the icon
            color: "#F14F4D", // hex format
            resume: true,
            hidden: false,
            bigText: true
        });

        // Override back button
        cordova.plugins.backgroundMode.overrideBackButton();

        // Enable background mode
        cordova.plugins.backgroundMode.setEnabled(true);

        // Check if the app is in the background
        const inBG = cordova.plugins.backgroundMode.isActive();
        if (inBG) {
            await startBackgroundTasks();
        }

        // Always start these tasks
        await startBackgroundTasks();
    } catch (error) {
        console.error("Error during initialization: " + error);
    }
}


async function startBackgroundTasks() {
    try {
        // Request microphone access
        const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
        // Load notifications
        loadNotifications();

        // Start socket if status is 'start'
        if (localStorage.getItem('status') === 'start') {
            await startSocket();
        }
    } catch (error) {
        console.error("Error accessing the microphone: " + error);
    }
}


async function startSocket() {
    localStorage.setItem('status', 'start');
    document.getElementById('stopView').style.display = 'block';
    document.getElementById('startView').style.display = 'none';

    let updated = await updateSettings();
    if (!updated) {
        return;
    }

    const intervalFunction = () => {
        startLoader();
    };

    // Call the function immediately
    intervalFunction();
    // Then set it to run every 10 seconds
    interValId = setInterval(intervalFunction, 10000);

}

let interValId;
let vibrationInterval;
async function updateSettings() {
    let pair = localStorage.getItem('pair');
    let timeframe = localStorage.getItem('timeframe');
    let no_of_bars = localStorage.getItem('no_of_bars');


    if (timeframe == null || no_of_bars == null || pair == null) {
        stopSocket();
        showSettings()
        return false;
    }

    document.getElementById('currentPair').innerText = pair;
    document.getElementById('currentTimeFrame').innerText = timeframe == "60" ? "1 Hr" : timeframe + " mins";
    document.getElementById('currentBars').innerText = no_of_bars;
    return true;

}
function showSettings() {
    let settingsDisplay = document.getElementById('settingsBlock').style.display;

    if (settingsDisplay == 'none') {
        document.getElementById('settingsBlock').style.display = 'block';
        document.getElementById('actionView').style.display = 'none';

    } else {
        document.getElementById('settingsBlock').style.display = 'none';
        document.getElementById('actionView').style.display = 'block';

    }

}
function trackValues() {
    let pair = document.getElementById('pair').value
    let timeframe = document.getElementById('timeframe').value;
    let no_of_bars = document.getElementById('no_of_bars').value;

    console.log(pair, timeframe, no_of_bars);
    localStorage.setItem('pair', pair);
    localStorage.setItem('no_of_bars', no_of_bars);
    localStorage.setItem('timeframe', timeframe);

    document.getElementById('settingsBlock').style.display = 'none';
    document.getElementById('actionView').style.display = 'block';
    startSocket();

}

function stopSocket() {
    localStorage.setItem('status', 'stop')
    document.getElementById('startView').style.display = 'block';
    document.getElementById('stopView').style.display = 'none';
    clearInterval(interValId)
}
function startAudio() {
    let audioFile = document.getElementById('myAudio')
    audioFile.play();

    const vibrationPattern = [2000, 1000, 2000, 1000, 2000, 1000, 2000, 1000, 2000, 1000, 200, 1000, 2000, 1000, 2000, 1000, 200, 1000, 200, 1000];
    navigator.vibrate(vibrationPattern);

}
function stopAudio() {
    let audioFile = document.getElementById('myAudio')
    audioFile.pause();
    audioFile.currentTime = 0;
    navigator.vibrate([])

    clearInterval(vibrationInterval);
}
async function startLoader() {
    const requestOptions = {
        method: "GET",
        redirect: "follow"
    };
    let min = localStorage.getItem('timeframe');
    let bars = localStorage.getItem('no_of_bars');
    let pairs = localStorage.getItem('pair');

    let timeCon = min * 60;

    fetch(`https://ytechno.com.ng/cronScript/?pair=${pairs}&timeframe=${timeCon}&limit=${bars}`)
        .then((response) => response.json())
        .then((result) => { })
        .catch((error) => console.error(error));


    let url_bitstamp = `https://www.bitstamp.net/api/v2/ohlc/${pairs}/?step=${timeCon}&limit=${bars}`;

    const fetchAndProcess = async () => {
        let currentData = await fetch(url_bitstamp, requestOptions)
            .then((response) => response.json())
            .then((result) => {
                let totalArray = result.data.ohlc;
                let currentCandle = totalArray[totalArray.length - 1];
                function findMatchingOpen(dataArray) {
                    const firstOpen = dataArray[dataArray.length - 1].open;
                    const firstClose = dataArray[dataArray.length - 1].close;

                    let candleStat = firstOpen < firstClose ? "Bullish" : "Bearish";
                    document.getElementById('currentCandle').innerText = `${currentCandle.open} ${candleStat}`;

                    const matchingData = [];

                    for (let i = 0; i <= dataArray.length - 2; i++) {
                        let canOpen = dataArray[i].open;
                        let canClose = dataArray[i].close;

                        let canStat = canOpen < canClose ? "Bullish" : "Bearish";

                        if (dataArray[i].open === firstOpen && canStat == candleStat) {
                            matchingData.push({ item: dataArray[i], index: i });
                        }
                    }
                    return matchingData;
                }

                let notifications = JSON.parse(localStorage.getItem('notifications')) || [];

                const matchingData = findMatchingOpen(totalArray);

                if (Object.keys(matchingData).length !== 0) {
                    console.log("Matching data found:");
                    startAudio();
                    console.log(matchingData);

                    notifications.push({
                        time: new Date().toLocaleDateString(),
                        price: matchingData[0].item.open,
                        pair: pairs,
                        timeframe: min,
                        candletime: new Date(matchingData[0].item.timestamp * 1000).toLocaleTimeString(),
                        bars: bars,
                        matches: matchingData.length,
                        matchesData: matchingData,
                    });

                    localStorage.setItem('notifications', JSON.stringify(notifications));
                    loadNotifications();
                    document.getElementById('candlesMatching').style.display = "block"
                    document.getElementById('priceFound').innerText = matchingData.length
                } else {
                    stopAudio();
                    console.log("No matching data found.");


                }
                return currentCandle.timestamp;
            })

            .catch((error) => console.error(error));

        const originalUnixTimestamp = currentData;
        let currentTime = Math.floor(Date.now() / 1000);

        let timeDifference = getTimeDifference(originalUnixTimestamp, currentTime);
        localStorage.setItem('timeDiff', JSON.stringify(timeDifference));
    }

    await fetchAndProcess();
    //if fthe minutes is equals to min then fetch the data
    let timeDiff = JSON.parse(localStorage.getItem('timeDiff')) || { hours: 0, minutes: 0, seconds: 0 };
    let coolDown = (min * 60) - ((timeDiff.minutes * 60) + timeDiff.seconds);
    // Initial delay before the first fetch
    let minit = Math.floor(coolDown / 60);
    let secnds = coolDown % 60;
    console.log(minit, "minutes", secnds, "seconds to the next request");

    // setTimeout(() => {
    //     fetchAndProcess();

    //     interValId = setInterval(() => {
    //         fetchAndProcess();
    //         console.log("Recurring fetch called");
    //     }, min * 60000);

    // }, coolDown * 1000);

}
function closePopup() {
    document.getElementById('candlesMatching').style.display = "none";
    stopAudio();
}
function showRecentAlarm() {
    document.getElementById('recentAlarm').style.display = "block";
}
function closeRecentAlarm() {
    document.getElementById('recentAlarm').style.display = "none";
}

function getTimeDifference(startTimestamp, endTimestamp) {
    // Calculate the difference in seconds
    let differenceInSeconds = endTimestamp - startTimestamp;
    // Calculate hours, minutes, and seconds
    const hours = Math.floor(differenceInSeconds / 3600);
    differenceInSeconds %= 3600;
    const minutes = Math.floor(differenceInSeconds / 60);
    const seconds = differenceInSeconds % 60;

    return {
        hours: hours,
        minutes: minutes,
        seconds: seconds
    };
}

function loadNotifications() {
    let notifications = JSON.parse(localStorage.getItem('notifications')) || [];
    let notificationList = document.getElementById('alarmHolder');
    var html = "";

    html += "<ul>";
    notifications.reverse().forEach((notification, index) => {
        html += `<li onclick="openMatches(${index})" class="border-b py-3">
                        <div class="grid grid-cols-2  p-2 hover:font-bold ${index == 0 && 'bg-red-200'} hover:bg-black/20 rounded">
                            <p>
                                Time: ${notification.time}
                            </p>
                            <p>
                                Price@Alert: ${notification.price}
                            </p>
                            <p>
                                Pair: <span style="text-transform:uppercase;">${notification.pair}</span>
                            </p>
                            <p>
                                Timeframe: ${notification.timeframe}
                            </p>
                            <p>
                                Bars: ${notification.bars}
                            </p>
                            <p>
                            Matches: ${notification.matches}
                            <p>
                             <p>
                                Candle Time: ${notification.candletime}
                            </p>
                        </div>
                    </li>`
    })


    html += "</ul>";

    if (notifications.length == 0) {
        html = "<h3 class='font-bold text-center'>No Notifications</h3>"
        notificationList.innerHTML = html;

    } else {
        notificationList.innerHTML = html;
    }
}

function closeMatches() {
    document.getElementById('matches').style.display = "none";
}
function openMatches(index) {
    document.getElementById('matches').style.display = "flex";

    let notifications = JSON.parse(localStorage.getItem('notifications')).reverse() || [];

    let html = "";
    for (const data of notifications[index].matchesData) {
        html += ` <div class="bg-black/20 p-1 rounded text-dark ">
                        <p class="font-bold">Candle Position: ${new Date(data.item.timestamp * 1000).toLocaleTimeString()}</p>
                        <div class="grid grid-cols-2">
                        <p>Open: ${data.item.open}</p>
                        <p>High: ${data.item.high}</p>
                        <p>Close: ${data.item.close}</p>
                        <p>Low : ${data.item.low}</p>
                        </div>
                    </div>`
    }

    document.getElementById('candleHolder').innerHTML = html;
}

