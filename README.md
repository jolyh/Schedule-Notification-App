# App name

This app notifies you about your upcoming shifts based on your schedule.
This displays your `assigned schedule` to easily visualise your shift. 

### The following information is displayed:

* Your current timezone
* Your schedule and its origin timezone
* Details of the schedules
* Notifications about your current status and status changes

Please submit bug reports to [Insert Link](). Pull requests are welcome.

### Example screenshot(s) (see more in screenshots folder):

![Screenshot of the app](/assets/screenshots/application.png "Application")
![Screenshot of the app notification](/assets/screenshots/notification.png "Application notification")

### Requirements

A custom user fields `assigned_schedule` is required for the app to work and should contain the ID
of the schedule that should apply to this user. 

### Installation settings

* Shift reminder time
* Use static timezones

### Testing

* Configure `zcli` on your desktop. 
* Run the app via terminal using `zcli apps:server`.
* Open your Zendesk account and add `?zcli_apps=true` to the url.
* Enjoy.

Note: you can provide mock data in the "/assets/mocks/" folder in json format for 'bundle.json', 'bundles.json', 'integrations.json' and 'job_specs.json' and set `mockDataEnabled` to `true` in `zendesk_api.js`

### Icon credit

[Reminder icons created by Gajah Mada - Flaticon](https://www.flaticon.com/free-icons/reminder)
