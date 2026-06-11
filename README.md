# OpenMRS Quiz Grader

Node app that grades /dev/1 quizes. SurveyMonkey responses are copied into a Google Spreadsheet via a [Zapier](https://zapier.com/) zap and
then this grader is pinged.

The grader scans the Google Spreadsheet for any entries that have not been graded and grades them. The respondent is notified whether or not she passed. If she passed, the respondent is granted a badge on OpenMRS Talk.

## Setup

* Establish a service account with Google API with sheets API privileges.
* Get an API key to Discourse (e.g., we use openmrsbot account)

Check out the repository:

```bash
$ git clone https://github.com/openmrs/openmrs-contrib-quizgrader
$ cd openmrs-contrib-quizgrader
$ cp example.env dev.env
# edit dev.env and fill in all required values
$ docker compose -f docker-compose-dev.yml build
$ docker compose -f docker-compose-dev.yml up
```

Configuration:

Edit `dev.env` (for development) or `prod.env` (for production) with the required values. See `example.env` for the full list of settings, including the Google Sheets API service account credentials and the Discourse API key.

## Running the grader

```bash
$ docker compose -f docker-compose-prod.yml up -d
```
