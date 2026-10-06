import unittest
from scripts.update import merge, valid, metal_points

class UpdateTests(unittest.TestCase):
    def test_preserves_history_and_revises_date(self):
        self.assertEqual(merge([{'date':'2020-01-01','value':1},{'date':'2020-02-01','value':2}], [{'date':'2020-02-01','value':3}]),[{'date':'2020-01-01','value':1},{'date':'2020-02-01','value':3}])
    def test_bad_payload_does_not_become_prices(self):
        with self.assertRaises(ValueError):metal_points('<html>Access denied</html>','nickel')
        with self.assertRaises(ValueError):valid([{'date':'2020-01-01','value':float('nan')}])
    def test_conflicts_rejected(self):
        with self.assertRaises(ValueError):valid([{'date':'2020-01-01','value':1},{'date':'2020-01-01','value':2}])
