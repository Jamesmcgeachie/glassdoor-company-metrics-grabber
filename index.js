const forms = {
  setupForm: () => { return document.getElementById("setup-form")},
  companyName: () => { return document.getElementById("company-name-form")},
  downloadForm: () => { return document.getElementById("download-form")}
}
const apiURL = 'http://api.glassdoor.com/api/api.htm'
let companyCount = 1;
let config = {
  'v': 1, // api version
  'format': 'json',
  't.p': '', // partner id
  't.k': '', // api key
  'userip': '', // user's ip address
  'useragent': navigator.userAgent,
  'action': 'employers',
  'callback': 'parseResponse' // jsonp callback function name
}
let companyReports = [];
let keyToHeaderMap = {
  name: 'Name',
  cultureAndValuesRating: 'Culture and Values',
  seniorLeadershipRating: 'Senior Leadership',
  compensationAndBenefitsRating: 'Compensation and Benefits',
  careerOpportunitiesRating: 'Career Opportunities',
  workLifeBalanceRating: 'Work Life Balance',
  ceoApproval: 'CEO Approval %',
  overallRating: 'Overall Rating' 
}

document.onreadystatechange = function () {
  if (document.readyState === "complete") {
    initApplication();
  }
}

function initApplication() {
  try {
    document.getElementById('api-key').value = window.localStorage.getItem('glassdoor-api-key');
    document.getElementById('partner-id').value = window.localStorage.getItem('glassdoor-partner-id');
  } catch(e) {
    console.error('Retrieving credentials from local storage failed. May be unavailable', e);
  }

  forms.setupForm().addEventListener('submit', recordConfigAndInitNameForm);
  forms.companyName().addEventListener('submit', clearTableAndGetReports);
  forms.downloadForm().addEventListener('submit', downloadReports);
}

function recordConfigAndInitNameForm(e) {
  e.preventDefault();
  companyCount = Number(document.getElementById('company-count').value);
  config['t.k'] = document.getElementById('api-key').value;
  config['t.p'] = document.getElementById('partner-id').value;
  config['userip'] = document.getElementById('ip-address').value;

  try {
    window.localStorage.setItem('glassdoor-api-key', config['t.k']);
    window.localStorage.setItem('glassdoor-partner-id', config['t.p']);
  } catch(e) {
    console.error('Saving credentials to local storage failed. May be unavailable', e);
  }

  document.getElementById('submit-setup').value = 'Update';

  initNameForm();
}

function initNameForm() {
  let inputFields = '';
  for (let i = 0; i < companyCount; i++) {
    inputFields = addInputField(inputFields, i);
  }
  forms.companyName().innerHTML = inputFields + `<div style="width: 100%; display: flex; justify-content: center; padding: 20px"><input type='submit' value='Get Glassdoor Data'/></div>`;
}

function addInputField(currentFields, i) {
  return `
    ${currentFields}
    <fieldset style='margin: 5px;'>
      <label for='company-name-${i}'>Company Name</label>
      <input name='company-name-${i}' id='company-name-${i}' type='text' plaeholder='Enter Company Name'/>
    </fieldset>
  `
}

function clearTableAndGetReports(e) {
  e.preventDefault();
  clearExistingTable();
  clearErrorMessage();
  showLoadingIndicator();
  getReports(getEnteredCompanyNames());
}

function saveAndDisplayReport(data) {
  let report = formatReport(data);
  companyReports.push(report);
  appendToTable(report);
}

function formatReport(data) {
  let report = {
    name: data.name,
    cultureAndValuesRating: data.cultureAndValuesRating,
    seniorLeadershipRating: data.seniorLeadershipRating,
    compensationAndBenefitsRating: data.compensationAndBenefitsRating,
    careerOpportunitiesRating: data.careerOpportunitiesRating,
    workLifeBalanceRating: data.workLifeBalanceRating,
    ceoApproval: data.ceo ? data.ceo.pctApprove : undefined,
    overallRating: data.overallRating
  }
  return report;
}

function getReports(companyNames) {
  function recursiveGetReport(companyNames, i) {
    if (i < companyNames.length) {
      getReport(companyNames[i], i)
        .then(() => {
          return recursiveGetReport(companyNames, i + 1);
        })
        .catch((error) => {
          insertErrorMessage(error);
          clearLoadingIndicator();
        });
    } else {
      clearLoadingIndicator();
    }
  }
  recursiveGetReport(companyNames, 0);
}

// Requests with JSONP approach as Glassdoor does not appear to support Cross Origin Resource Sharing.
function getReport(company, i) {
  return new Promise((res, rej) => {
    if (!company) {
      res()
    } else {
      let scriptTag = document.createElement('SCRIPT');
      scriptTag.src = apiURL + constructParams(company);
      scriptTag.id = 'REQUEST' + i;
      document.getElementsByTagName('HEAD')[0].appendChild(scriptTag);
      scriptTag.onerror = (event) => {
        rej(determineErrorCause(event));
      }
    }

    window['parseResponse'] = function(data) {
      setTimeout(() => {
        if (data.response) {
          if (data.response.employers) {
            data.response.employers.forEach(saveAndDisplayReport);
            document.getElementsByTagName('HEAD')[0].removeChild(document.getElementById('REQUEST' + i))
            res();
          }
        }
      }, 200)
    }
  });
}

function appendToTable(report) {
  let dataTable = getDataTable();
  let newRow = dataTable.insertRow(dataTable.rows.length);
  newRow.innerHTML = renderResponseRow(report);
}

function clearExistingTable() {
  getDataTable().innerHTML = '';
}

function showLoadingIndicator() {
  document.getElementById('loading-container').innerHTML = `<p style="background-color: cyan; color: white; border: 1px solid black;">Downloading Data...</p>`;
}

function insertErrorMessage(error) {
  document.getElementById('error-container').innerHTML = `<p style="background-color: red; color: white; border: 1px solid black;">${error}</p>`;
}

function clearErrorMessage(error) {
  document.getElementById('error-container').innerHTML = '';
}

function clearLoadingIndicator(error) {
  document.getElementById('loading-container').innerHTML = '';
}

function getDataTable() {
  return document.getElementById('data-table-body');
}

function getEnteredCompanyNames() {
  return [...document.querySelectorAll('#company-name-form input[type=text]')].map((input) => { return input.value })
}

/* 
  Difficult to get access to HTTP status code with JSONP,
  so figuring out probable cause based on when error occured rather than HTTP response.
*/
function determineErrorCause(event) {
  let requestNumber = Number(event.target.id.split('REQUEST')[1]);
  if (!requestNumber) {
    return 'Request Failed. Please check you entered the correct API Key, Partner ID and IP Address. Alternatively, Glassdoor may be down, or you may have been temporarily locked out due to excessive requests.';
  } else if (requestNumber >= 1) {
    return `Company Request ${requestNumber + 1} Failed. You may be requesting too much data too quickly. Slow down.`;
  } else {
    return 'An unknown error occured.';
  }
}

function constructParams(company) {
  return Object.keys(config)
    .map((key, i ) => { 
      return i === 0 ? `?${key}=${config[key]}` : `&${key}=${config[key]}`
    })
    .reduce((acc, value) => {
      return acc + value;
    }, '') + `&q=${company}`;
}

function downloadReports(e) {
  e.preventDefault();
  const headings = Object.keys(companyReports[0]).map(key => keyToHeaderMap[key]).reduce(flattenArray, '');
  const csvFormattedData = 'data:text/csv;charset=utf-8,' + headings + '\n' + companyReports.map(convertToArray).reduce(createCSVString, '');
  let encodedUri = encodeURI(csvFormattedData);
  let link = document.createElement("a");
  link.setAttribute("href", encodedUri);
  link.setAttribute("download", "glassdoor_company_data.csv");
  document.body.appendChild(link);
  link.click();
}

function convertToArray(report) {
  let values = [];
  Object.keys(report).forEach(key => values.push(report[key]));
  return values;
}

function createCSVString(accumulator, value, index, reports) {
  return index < reports.length ? accumulator + value.reduce(flattenArray, '') + '\n' : accumulator + reduceInner(value);
}

function flattenArray(a, v, i, arr) {
  let safeV = v ? v : 'N/A';
  if (typeof safeV === 'string' && safeV.indexOf(',') > -1) {
    safeV = '"' + safeV + '"';  
  }
  return i < arr.length ? a + safeV + ',' : a + safeV 
}

function renderResponseRow(report) {
  return `
    <td>
      ${report.name}
    </td>
    <td>
      ${report.cultureAndValuesRating}
    </td>
    <td>
      ${report.seniorLeadershipRating}
    </td>
    <td>
      ${report.compensationAndBenefitsRating}
    </td>
    <td>
      ${report.careerOpportunitiesRating}
    </td>
    <td>
      ${report.workLifeBalanceRating}
    </td>
    <td>
      ${report.ceoApproval ? report.ceoApproval + '%' : 'N/A'}
    </td>
    <td>
      ${report.overallRating}
    </td>
  `
}