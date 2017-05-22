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
$ cd openmrs-contrib-quizgrader/app
$ cp docker-compose-dev_example.yml docker-compose-dev.yml
# edit docker-compose-dev.yml file and add all the necessary values
$ docker-compose build
$ docker-compose -f docker-compose.yml -f docker-compose-dev.yml up
```


Configuration:

Edit the settings in `docker-compose.yml` as needed. The key from Google Sheets API (JSON format) and API key and user for Discourse must be set for things to work properly.

## Running the grader

```bash
$ docker-compose up -d
```
