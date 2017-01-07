# OpenMRS Quiz Grader

Node app that grades /dev/1 quizes. SurveyMonkey responses are copied into a Google Spreadsheet via a [Zapier](https://zapier.com/) zap and 
then this grader is pinged.

The grader scans the Google Spreadsheet for any entries that have not been graded and grades them. The respondent is notified whether or not she passed. If she passed, the respondent is granted a badge on OpenMRS Talk.

## Setup

* Establish a service account with Google API with sheets API privileges.
* Get an API key to Discourse (e.g., we use openmrsbot account)

Check out the repository:

```bash
$ git clone https://github.com/bmamlin/openmrs-contrib-quizgrader
```

Install dependencies:

```bash
$ cd quizgrader
$ # One time install dependencies
$ docker-compose run --rm app npm install
```

Configuration:

```bash
$ cd app
$ mkdir config
$ cp default.sample.json config/default.json
```

Edit the settings in `app/config/default.json` as needed. The key from Google Sheets API (JSON format) and API key and user for Discourse must be set for things to work properly.

## Running the grader

```bash
$ docker-compose up -d
```

