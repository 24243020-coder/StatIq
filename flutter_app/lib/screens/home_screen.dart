import 'package:flutter/material.dart';
import '../services/api_service.dart';
import '../widgets/widgets.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});
  @override
  State<HomeScreen> createState() => _HomeScreenState();
}

class _HomeScreenState extends State<HomeScreen> {
  // ── state ────────────────────────────────────────────────────
  int    _tab     = 0;
  bool   _loading = false;
  String? _error;
  Map<String, dynamic>? _result;

  // ── controllers ──────────────────────────────────────────────
  final _dataC  = TextEditingController(text: '12, 15, 18, 10, 22, 9, 14, 100, 13, 17, 20, 11');
  final _xC     = TextEditingController(text: '1, 2, 3, 4, 5, 6, 7, 8');
  final _yC     = TextEditingController(text: '2, 4, 5, 7, 8, 9, 10, 12');
  final _myC    = TextEditingController(text: '10, 20, 30, 40, 50, 60, 70');
  final _mx1C   = TextEditingController(text: '1, 2, 3, 4, 5, 6, 7');
  final _mx2C   = TextEditingController(text: '2, 4, 5, 7, 8, 9, 10');
  final _nvC    = TextEditingController(text: '75');
  final _nmC    = TextEditingController(text: '70');
  final _nsdC   = TextEditingController(text: '10');

  // ── tab definitions ──────────────────────────────────────────
  static const _tabs = [
    (icon: Icons.bar_chart,         label: 'Frequency'),
    (icon: Icons.calculate,         label: 'Averages'),
    (icon: Icons.rule,              label: 'Variability'),
    (icon: Icons.search,            label: 'Outliers'),
    (icon: Icons.show_chart,        label: 'Normal Dist.'),
    (icon: Icons.stacked_line_chart,label: 'Z-Scores'),
    (icon: Icons.link,              label: 'Correlation'),
    (icon: Icons.trending_up,       label: 'Regression'),
    (icon: Icons.grid_on,           label: 'Multi-Reg.'),
  ];

  // ── helpers ──────────────────────────────────────────────────
  String f(dynamic v, [int d = 2]) {
    if (v == null) return '—';
    final n = double.tryParse(v.toString());
    if (n == null) return v.toString();
    return n.toStringAsFixed(d);
  }
  String f4(dynamic v) => f(v, 4);
  String fp(dynamic v) => '${f(v)}%';

  // ── calculate ─────────────────────────────────────────────────
  Future<void> _calc() async {
    setState(() { _loading = true; _error = null; _result = null; });
    Map<String, dynamic> res;
    try {
      switch (_tab) {
        case 0: res = await ApiService.frequency(_dataC.text);   break;
        case 1: res = await ApiService.averages(_dataC.text);    break;
        case 2: res = await ApiService.variability(_dataC.text); break;
        case 3: res = await ApiService.outliers(_dataC.text);    break;
        case 4: res = await ApiService.normalDist(
                  double.tryParse(_nvC.text)  ?? 0,
                  double.tryParse(_nmC.text)  ?? 0,
                  double.tryParse(_nsdC.text) ?? 1,
                ); break;
        case 5: res = await ApiService.zScores(_dataC.text);     break;
        case 6: res = await ApiService.correlation(_xC.text, _yC.text); break;
        case 7: res = await ApiService.regression(_xC.text, _yC.text);  break;
        case 8: res = await ApiService.multipleRegression(
                  _myC.text, [_mx1C.text, _mx2C.text]); break;
        default: res = {'success': false, 'error': 'Unknown tab'};
      }
      if (!mounted) return;
      setState(() {
        _loading = false;
        if (res['success'] == true) {
          _result = res['result'] as Map<String, dynamic>;
        } else {
          _error = res['error']?.toString() ?? 'Unknown error';
        }
      });
    } catch (e) {
      if (!mounted) return;
      setState(() { _loading = false; _error = e.toString(); });
    }
  }

  // ── build ─────────────────────────────────────────────────────
  @override
  Widget build(BuildContext context) {
    final wide = MediaQuery.of(context).size.width > 800;
    return Scaffold(
      body: Row(children: [
        // sidebar nav
        NavigationRail(
          selectedIndex: _tab,
          extended: wide,
          onDestinationSelected: (i) {
            setState(() { _tab = i; _result = null; _error = null; });
          },
          leading: Padding(
            padding: const EdgeInsets.symmetric(vertical: 12),
            child: Text('📊 StatCalc',
              style: TextStyle(fontWeight: FontWeight.bold, color: Theme.of(context).colorScheme.primary, fontSize: wide ? 16 : 12)),
          ),
          destinations: _tabs.map((t) =>
            NavigationRailDestination(icon: Icon(t.icon), label: Text(t.label))
          ).toList(),
        ),
        const VerticalDivider(thickness: 1, width: 1),
        // main panel
        Expanded(child: Column(children: [
          _inputPanel(),
          Expanded(child: _resultsPanel()),
        ])),
      ]),
    );
  }

  // ── input panel ───────────────────────────────────────────────
  Widget _inputPanel() {
    return Container(
      color: Colors.white,
      padding: const EdgeInsets.all(14),
      child: Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
        // single series
        if (![6,7,8,4].contains(_tab)) _tf(_dataC, 'Data values (comma separated)', 2),
        // X/Y
        if ([6,7].contains(_tab)) Row(children: [
          Expanded(child: _tf(_xC, 'X values', 2)),
          const SizedBox(width: 12),
          Expanded(child: _tf(_yC, 'Y values', 2)),
        ]),
        // multiple regression
        if (_tab == 8) ...[
          _tf(_myC, 'Y — outcome values', 2),
          const SizedBox(height: 8),
          Row(children: [
            Expanded(child: _tf(_mx1C, 'X1 — predictor 1', 2)),
            const SizedBox(width: 12),
            Expanded(child: _tf(_mx2C, 'X2 — predictor 2', 2)),
          ]),
        ],
        // normal dist inputs
        if (_tab == 4) Row(children: [
          Expanded(child: _nf(_nvC,  'Value (X)')),
          const SizedBox(width: 10),
          Expanded(child: _nf(_nmC,  'Mean (μ)')),
          const SizedBox(width: 10),
          Expanded(child: _nf(_nsdC, 'Std dev (σ)')),
        ]),
        const SizedBox(height: 12),
        SizedBox(
          width: double.infinity,
          child: FilledButton.icon(
            onPressed: _loading ? null : _calc,
            icon: _loading
                ? const SizedBox(width:16, height:16,
                    child: CircularProgressIndicator(strokeWidth:2, color:Colors.white))
                : const Icon(Icons.play_arrow),
            label: Text(_loading ? 'Calculating…' : 'Calculate'),
            style: FilledButton.styleFrom(padding: const EdgeInsets.symmetric(vertical: 13)),
          ),
        ),
      ]),
    );
  }

  Widget _tf(TextEditingController ctrl, String label, int lines) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey, letterSpacing: 0.5)),
      const SizedBox(height: 4),
      TextField(controller: ctrl, maxLines: lines, style: const TextStyle(fontSize: 13, fontFamily: 'monospace')),
      const SizedBox(height: 8),
    ]);
  }

  Widget _nf(TextEditingController ctrl, String label) {
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      Text(label.toUpperCase(), style: const TextStyle(fontSize: 10, fontWeight: FontWeight.w600, color: Colors.grey, letterSpacing: 0.5)),
      const SizedBox(height: 4),
      TextField(controller: ctrl, keyboardType: TextInputType.number, style: const TextStyle(fontSize: 13)),
    ]);
  }

  // ── results panel ─────────────────────────────────────────────
  Widget _resultsPanel() {
    if (_loading) return const Center(child: CircularProgressIndicator());
    if (_error != null) return _errBox(_error!);
    if (_result == null) return _welcome();
    return SingleChildScrollView(
      padding: const EdgeInsets.all(16),
      child: _renderResult(),
    );
  }

  Widget _welcome() => Center(
    child: Column(mainAxisAlignment: MainAxisAlignment.center, children: [
      const Text('📊', style: TextStyle(fontSize: 56)),
      const SizedBox(height: 16),
      Text('Statistics Calculator', style: Theme.of(context).textTheme.titleLarge),
      const SizedBox(height: 8),
      const Text('Enter data above and press Calculate', style: TextStyle(color: Colors.grey)),
      const SizedBox(height: 4),
      const Text('All 9 modules · Node.js backend', style: TextStyle(fontSize: 12, color: Colors.grey)),
    ]),
  );

  Widget _errBox(String msg) => Padding(
    padding: const EdgeInsets.all(16),
    child: Container(
      padding: const EdgeInsets.all(16),
      decoration: BoxDecoration(color: const Color(0xFFFFF0F0), borderRadius: BorderRadius.circular(10), border: Border.all(color: const Color(0xFFF5C4C4))),
      child: Text('❌  $msg', style: const TextStyle(color: Color(0xFFE24B4A), height: 1.6)),
    ),
  );

  // ── result renderers ──────────────────────────────────────────
  Widget _renderResult() {
    switch (_tab) {
      case 0: return _freqView();
      case 1: return _avgView();
      case 2: return _varView();
      case 3: return _outlierView();
      case 4: return _normalView();
      case 5: return _zView();
      case 6: return _corrView();
      case 7: return _regView();
      case 8: return _multiView();
      default: return const SizedBox();
    }
  }

  // 1 - frequency
  Widget _freqView() {
    final r = _result!;
    final bins = r['bins'] as List;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'n', value:'${r['n']}'),
        MetricCard(label:'Min', value:f(r['min'])),
        MetricCard(label:'Max', value:f(r['max'])),
        MetricCard(label:'Bin width', value:f(r['binWidth'])),
      ]),
      const SectionTitle('Frequency distribution table'),
      StatsTable(
        headers: const ['Interval','Freq','Rel %','Cumul','Cumul %'],
        rows: bins.map<List<String>>((b) => [
          b['interval'], '${b['frequency']}', '${b['relativeFreq']}%',
          '${b['cumulativeFreq']}', '${b['cumulativePct']}%',
        ]).toList(),
      ),
    ]);
  }

  // 2 - averages
  Widget _avgView() {
    final r    = _result!;
    final diff = ((r['mean'] as num) - (r['median'] as num)).abs() / (r['mean'] as num).abs() * 100;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Mean (x̄)',  value:f(r['mean']),   accent:true),
        MetricCard(label:'Median',     value:f(r['median']), accent:true),
        MetricCard(label:'Mode',       value:(r['mode'] as List).map((v)=>f(v)).join(', '), accent:true),
        MetricCard(label:'n',          value:'${r['n']}'),
        MetricCard(label:'Min',        value:f(r['min'])),
        MetricCard(label:'Max',        value:f(r['max'])),
        MetricCard(label:'Skewness',   value:f4(r['skewness'])),
        MetricCard(label:'Kurtosis',   value:f4(r['kurtosis'])),
      ]),
      diff > 15
        ? InfoStrip.amber('⚠ Mean (${f(r['mean'])}) and median (${f(r['median'])}) differ by ${diff.toStringAsFixed(1)}% — outliers may be skewing the mean.')
        : InfoStrip.green('✅ Mean ≈ Median — distribution is roughly symmetric.\nShape: ${r['shape']}'),
    ]);
  }

  // 3 - variability
  Widget _varView() {
    final r = _result!;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Range',       value:f(r['range']),      accent:true),
        MetricCard(label:'Variance s²', value:f(r['variance']),   accent:true),
        MetricCard(label:'Std dev s',   value:f(r['stdDev']),     accent:true),
        MetricCard(label:'CV',          value:fp(r['cv']),        accent:true),
        MetricCard(label:'Q1',          value:f(r['q1'])),
        MetricCard(label:'Q3',          value:f(r['q3'])),
        MetricCard(label:'IQR',         value:f(r['iqr'])),
        MetricCard(label:'Lower fence', value:f(r['lowerFence'])),
        MetricCard(label:'Upper fence', value:f(r['upperFence'])),
      ]),
      InfoStrip.blue(
        'IQR = Q3 − Q1 = ${f(r['q3'])} − ${f(r['q1'])} = ${f(r['iqr'])}\n'
        'Lower fence: ${f(r['lowerFence'])}   |   Upper fence: ${f(r['upperFence'])}'
      ),
    ]);
  }

  // 4 - outliers
  Widget _outlierView() {
    final r       = _result!;
    final details = r['details'] as List;
    final count   = r['count'] as int;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Outliers',     value:'$count', warn:count>0, good:count==0),
        MetricCard(label:'Lower fence',  value:f(r['lowerFence'])),
        MetricCard(label:'Upper fence',  value:f(r['upperFence'])),
        MetricCard(label:'Mean',         value:f(r['mean'])),
        MetricCard(label:'Std dev',      value:f(r['stdDev'])),
      ]),
      count > 0
        ? InfoStrip.red('⚠ $count outlier(s): ${(r['outliers'] as List).join(', ')}')
        : const InfoStrip.green('✅ No outliers detected.'),
      const SectionTitle('All values — outlier analysis'),
      StatsTable(
        headers: const ['#','Value','Z-score','IQR test','Z test','Status'],
        highlightRow: details.map<bool>((d) => d['isOutlier'] as bool).toList(),
        rows: details.map<List<String>>((d) => [
          '${d['index']}', f(d['value']), f4(d['zScore']),
          d['iqrOutlier'] ? '⚠ Outside' : '✅ OK',
          d['zOutlier']   ? '⚠ |z|>3'   : '✅ OK',
          d['isOutlier']  ? '⚠ Outlier'  : '✅ Normal',
        ]).toList(),
      ),
    ]);
  }

  // 5 - normal dist
  Widget _normalView() {
    final r = _result!;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Z-score',         value:f4(r['z']),                     accent:true),
        MetricCard(label:'P(X ≤ value)',    value:fp((r['pBelow'] as num)*100),   accent:true),
        MetricCard(label:'P(X > value)',    value:fp((r['pAbove'] as num)*100),   accent:true),
        MetricCard(label:'Percentile',      value:'${f(r['percentile'],1)}th',    accent:true),
      ]),
      InfoStrip.blue(
        'Z = ${f4(r['z'])}\n'
        '${fp((r['pBelow'] as num)*100)} of the distribution falls below this value.\n'
        '${fp((r['pAbove'] as num)*100)} falls above.',
      ),
    ]);
  }

  // 6 - z scores
  Widget _zView() {
    final r  = _result!;
    final zs = r['zScores'] as List;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Mean',    value:f(r['mean']),   accent:true),
        MetricCard(label:'Std dev', value:f(r['stdDev']), accent:true),
      ]),
      const InfoStrip.blue('Z = (value − mean) / std dev. |z| > 3 = extreme outlier, |z| > 2 = unusual.'),
      const SectionTitle('Z-score table'),
      StatsTable(
        headers: const ['#','Value','Z-score','Percentile','Status'],
        highlightRow: zs.map<bool>((z) => (z['zScore'] as num).abs() > 3).toList(),
        rows: zs.map<List<String>>((z) => [
          '${z['index']}', f(z['value']), f4(z['zScore']),
          '${f(z['percentile'],1)}th',
          (z['zScore'] as num).abs() > 3 ? '⚠ Extreme'
          : (z['zScore'] as num).abs() > 2 ? '! Unusual' : '✅ Normal',
        ]).toList(),
      ),
    ]);
  }

  // 7 - correlation
  Widget _corrView() {
    final r = _result!;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Pearson r',   value:f4(r['pearsonR']),   accent:true),
        MetricCard(label:'Spearman ρ',  value:f4(r['spearmanR']),  accent:true),
        MetricCard(label:'R²',          value:fp((r['r2'] as num)*100), accent:true),
        MetricCard(label:'t-statistic', value:f4(r['tStatistic'])),
      ]),
      InfoStrip.green(
        '${r['interpretation']}\n'
        'R² = ${fp((r['r2'] as num)*100)} of variance in Y explained by X.',
      ),
      const SectionTitle('Data pairs'),
      StatsTable(
        headers: const ['#','X','Y'],
        rows: (r['pairs'] as List).asMap().entries.map<List<String>>((e) =>
          ['${e.key+1}', f(e.value['x']), f(e.value['y'])]
        ).toList(),
      ),
    ]);
  }

  // 8 - regression
  Widget _regView() {
    final r = _result!;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'Slope (b)',     value:f4(r['slope']),     accent:true),
        MetricCard(label:'Intercept (a)', value:f4(r['intercept']), accent:true),
        MetricCard(label:'R²',            value:fp((r['r2'] as num)*100), accent:true),
        MetricCard(label:'Pearson r',     value:f4(r['r']),         accent:true),
        MetricCard(label:'SEE',           value:f4(r['see'])),
      ]),
      InfoStrip.green(
        'Equation: ${r['equation']}\n'
        'R² = ${fp((r['r2'] as num)*100)} — SEE = ${f4(r['see'])}',
      ),
      const SectionTitle('Predictions table'),
      StatsTable(
        headers: const ['#','X','Y actual','Ŷ predicted','Residual'],
        rows: (r['pairs'] as List).asMap().entries.map<List<String>>((e) {
          final p = e.value;
          return ['${e.key+1}', f(p['x']), f(p['y']), f4(p['predicted']), f4(p['residual'])];
        }).toList(),
      ),
    ]);
  }

  // 9 - multiple regression
  Widget _multiView() {
    final r     = _result!;
    final coefs = r['coefficients'] as List;
    return Column(crossAxisAlignment: CrossAxisAlignment.start, children: [
      _metrics([
        MetricCard(label:'R²',          value:fp((r['r2'] as num)*100),    accent:true),
        MetricCard(label:'Adjusted R²', value:fp((r['adjR2'] as num)*100), accent:true),
        MetricCard(label:'SEE',         value:f4(r['see']),                accent:true),
      ]),
      InfoStrip.green(
        'Equation: ${r['equation']}\n'
        'Adjusted R² = ${fp((r['adjR2'] as num)*100)} (penalises for extra predictors)',
      ),
      const SectionTitle('Coefficients'),
      StatsTable(
        headers: const ['Predictor','Coefficient','Interpretation'],
        rows: coefs.asMap().entries.map<List<String>>((e) {
          final c = e.value;
          return [
            c['label'],
            f4(c['value']),
            e.key == 0 ? 'Expected Y when all X = 0'
                       : '1-unit ↑ X${e.key} → ${f4(c['value'])} change in Y',
          ];
        }).toList(),
      ),
    ]);
  }

  // ── layout helper ─────────────────────────────────────────────
  Widget _metrics(List<Widget> cards) => Padding(
    padding: const EdgeInsets.only(bottom: 14),
    child: Wrap(spacing: 10, runSpacing: 10, children: cards),
  );
}
