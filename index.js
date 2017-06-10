let forms = {
  setupForm: () => { return document.getElementById("setup-form")},
  companyName: () => { return document.getElementById("company-name-form")},
  downloadForm: () => { return document.getElementById("download-form")}
}

let config = {
  'v': 1,
  'format': 'json',
  't.p': '',
  't.k': '',
  'userip': '',
  'useragent': navigator.userAgent,
  'action': 'employers',
  'url': 'http://api.glassdoor.com/api/api.htm',
  'count': 1
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
  forms.setupForm().addEventListener('submit', recordConfigAndInitNameForm);
  forms.companyName().addEventListener('submit', clearTableAndGetReports);
  forms.downloadForm().addEventListener('submit', downloadReports);
}

function recordConfigAndInitNameForm(e) {
  e.preventDefault();
  config['count'] = Number(document.getElementById('company-count').value);
  config['t.k'] = document.getElementById('api-key').value;
  config['t.p'] = document.getElementById('partner-id').value;
  config['userip'] = document.getElementById('ip-address').value;
  initNameForm();
}

function initNameForm() {
  let inputFields = '';
  for (let i = 0; i < config.count; i++) {
    inputFields = addInputField(inputFields, i);
  }
  forms.companyName().innerHTML = inputFields + `<input type='submit' value='Get Glassdoor Data'/>`;
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
  clearExistingTable()
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
      getReport(companyNames[i])
        .then(() => {
          return recursiveGetReport(companyNames, i + 1);
        });
    }
  }
  recursiveGetReport(companyNames, 0);
}

// Requests with JSONP approach as Glassdoor does not appear to support Cross Origin Resource Sharing.
function getReport(company) {
  return new Promise((res, rej) => {
    if (!company) {
      res()
    } else {
      var scriptTag = document.createElement('SCRIPT');
      scriptTag.src = config.url + constructParams(company);
      document.getElementsByTagName('HEAD')[0].appendChild(scriptTag);
    }

    window['parseResponse'] = function(data) {
      setTimeout(() => {
        if (data.response) {
          if (data.response.employers) {
            data.response.employers.forEach(saveAndDisplayReport);
            res();
          }
        }
      }, 100)
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

function getDataTable() {
  return document.getElementById('data-table-body');
}

function getEnteredCompanyNames() {
  return [...document.querySelectorAll('#company-name-form input[type=text]')].map((input) => { return input.value })
}

function constructParams(company) {
  return `?t.p=${config['t.p']}&t.k=${config['t.k']}&userip=${config['userip']}&useragent=${config['useragent']}&format=${config['format']}&v=${config['v']}&action=${config['action']}&q=${company}&callback=parseResponse`
}

function downloadReports(e) {
  e.preventDefault();
  var headings = Object.keys(companyReports[0]).map(key => keyToHeaderMap[key]).reduce(flattenArray, '');
  var csvFormattedData = 'data:text/csv;charset=utf-8,' + headings + '\n' + companyReports.map(convertToArray).reduce(createCSVString, '');
  var encodedUri = encodeURI(csvFormattedData);
  var link = document.createElement("a");
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
  const safeV = v ? v : 'N/A';
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