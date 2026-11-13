p = 'src/client/index.css'
s = open(p, encoding='utf-8').read()

s = s.replace("""  --ink: #0b0908;
  --ink-2: #14100e;
  --brick: #2a1d17;
  --brick-lit: #3a2620;
  --ember: #e2531f;
  --ember-hot: #ffb35e;
  --porcelain: #f2ede4;
  --porcelain-dim: #cdc3b6;
  --muted: #a3958a;
  --line: rgba(242, 237, 228, 0.14);
  --line-strong: rgba(242, 237, 228, 0.28);
  --card: rgba(242, 237, 228, 0.045);""",
"""  /* Daylight, not night: paper, clay and one deep doorway of fire. */
  --ink: #f4ede2;
  --ink-2: #ece2d3;
  --brick: #b4552f;
  --brick-lit: #cf6c40;
  --ember: #c2451c;
  --ember-hot: #e2571f;
  --porcelain: #221a14;
  --porcelain-dim: #4a3b30;
  --muted: #6b5d50;
  --line: rgba(34, 26, 20, 0.18);
  --line-strong: rgba(34, 26, 20, 0.38);
  --card: rgba(34, 26, 20, 0.045);""")

s = s.replace("""body {
  margin: 0;
  background: var(--ink);""","""body {
  margin: 0;
  background: var(--ink);""")

s = s.replace("""  background:
    radial-gradient(120% 80% at 50% 118%, rgba(226, 83, 31, 0.16), transparent 62%),
    radial-gradient(80% 60% at 50% -10%, rgba(126, 155, 209, 0.07), transparent 70%),
    linear-gradient(180deg, #0d0a09 0%, #0b0908 55%, #100b09 100%);""",
"""  background:
    radial-gradient(120% 80% at 50% 120%, rgba(180, 85, 47, 0.18), transparent 62%),
    radial-gradient(80% 60% at 50% -10%, rgba(47, 90, 168, 0.06), transparent 70%),
    linear-gradient(180deg, #f7f1e7 0%, #f4ede2 55%, #ece2d3 100%);""")

s = s.replace("""  background-image: radial-gradient(rgba(255, 255, 255, 0.7) 0.5px, transparent 0.6px);
  background-size: 3px 3px;
  mix-blend-mode: overlay;""",
"""  background-image: radial-gradient(rgba(34, 26, 20, 0.55) 0.5px, transparent 0.6px);
  background-size: 3px 3px;
  mix-blend-mode: multiply;""")

s = s.replace("""  background: #080605;""", """  background: #f7f1e7;""")
s = s.replace("""  background: rgba(0, 0, 0, 0.25);
}""", """  background: rgba(255, 255, 255, 0.5);
}""")
s = s.replace("""  color: var(--porcelain-dim);
  background: rgba(0, 0, 0, 0.25);""", """  color: var(--porcelain-dim);
  background: rgba(255, 255, 255, 0.55);""")
s = s.replace("""  background: rgba(8, 6, 5, 0.55);
  padding: 4px 9px;""", """  background: rgba(255, 255, 255, 0.72);
  padding: 4px 9px;""")
s = s.replace("""  color: var(--ember-hot);
  border-color: rgba(226, 83, 31, 0.4);""", """  color: var(--ember);
  border-color: rgba(194, 69, 28, 0.45);""")
s = s.replace("""  border-color: var(--ember);
  background: rgba(226, 83, 31, 0.12);
  box-shadow: inset 0 0 0 1px rgba(226, 83, 31, 0.35);""",
"""  border-color: var(--ember);
  background: rgba(194, 69, 28, 0.09);
  box-shadow: inset 0 0 0 1px rgba(194, 69, 28, 0.4);""")
s = s.replace(""".btn.primary {
  background: var(--ember);
  color: #180a04;
}

.btn.primary:hover {
  background: #f0642d;
}""", """.btn.primary {
  background: var(--ember);
  color: #fff7ec;
}

.btn.primary:hover {
  background: #a93a16;
}""")
s = s.replace("""  background: linear-gradient(90deg, #1a120e 0%, #241713 50%, #1a120e 100%);""",
              """  background: linear-gradient(90deg, #efe5d6 0%, #e7dbca 50%, #efe5d6 100%);""")
s = s.replace("""  background: linear-gradient(180deg, rgba(226, 83, 31, 0.35), rgba(226, 83, 31, 0.12));
  border-left: 1px solid rgba(226, 83, 31, 0.7);
  border-right: 1px solid rgba(226, 83, 31, 0.7);""",
"""  background: linear-gradient(180deg, rgba(226, 87, 31, 0.30), rgba(226, 87, 31, 0.10));
  border-left: 1px solid rgba(194, 69, 28, 0.8);
  border-right: 1px solid rgba(194, 69, 28, 0.8);""")
s = s.replace("""  background: var(--porcelain);
  box-shadow: 0 0 14px rgba(255, 190, 120, 0.9);""",
"""  background: #221a14;
  box-shadow: 0 0 12px rgba(226, 87, 31, 0.55);""")
s = s.replace("""  background: rgba(242, 237, 228, 0.16);""", """  background: rgba(34, 26, 20, 0.14);""")
s = s.replace("""  border: 1px solid rgba(226, 83, 31, 0.55);
  background: radial-gradient(120% 140% at 0% 0%, rgba(226, 83, 31, 0.18), transparent 60%);""",
"""  border: 1px solid rgba(194, 69, 28, 0.45);
  background: radial-gradient(120% 140% at 0% 0%, rgba(226, 87, 31, 0.10), transparent 60%);""")
s = s.replace("""  border: 1px solid rgba(216, 178, 90, 0.4);
  background: rgba(216, 178, 90, 0.09);
  font-size: 12.5px;
  color: #f0dcae;""",
"""  border: 1px solid rgba(160, 116, 36, 0.4);
  background: rgba(192, 138, 46, 0.12);
  font-size: 12.5px;
  color: #6b4a05;""")
s = s.replace("""    radial-gradient(120% 120% at 8% 110%, rgba(226, 83, 31, 0.22), transparent 60%),
    linear-gradient(180deg, #100b09, #0b0908);""",
"""    radial-gradient(120% 120% at 8% 110%, rgba(180, 85, 47, 0.22), transparent 62%),
    linear-gradient(180deg, #fbf6ec, #f0e6d6);""")
s = s.replace("""  border: 1px solid rgba(242, 237, 228, 0.08);
  background:
    radial-gradient""", """  border: 1px solid rgba(34, 26, 20, 0.10);
  background:
    radial-gradient""")
s = s.replace("""  background: #0a0806;""", """  background: #efe5d6;""")
s = s.replace("""  border: 1px solid rgba(242, 237, 228, 0.07);""", """  border: 1px solid rgba(34, 26, 20, 0.12);""")
open(p, 'w', encoding='utf-8').write(s)
print('css lightened')
